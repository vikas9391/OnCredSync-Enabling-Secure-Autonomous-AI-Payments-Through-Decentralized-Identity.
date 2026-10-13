use axum::{
    extract::{Path, State},
    http::{header, HeaderValue, Method, StatusCode},
    routing::{get, patch, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{postgres::PgPoolOptions, FromRow, PgPool};
use std::{env, net::SocketAddr};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::EnvFilter;
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    db: PgPool,
}

#[derive(Debug, Serialize, FromRow)]
struct Agent {
    id: Uuid,
    name: String,
    owner: String,
    did: String,
    wallet_address: Option<String>,
    network: String,
    status: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
struct Policy {
    id: Uuid,
    agent_id: Uuid,
    name: String,
    transaction_limit_cents: i64,
    daily_limit_cents: i64,
    approved_merchants: Vec<String>,
    valid_until: Option<DateTime<Utc>>,
    revoked: bool,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
struct Payment {
    id: Uuid,
    agent_id: Uuid,
    merchant: String,
    purpose: String,
    amount_cents: i64,
    status: String,
    rejection_reason: Option<String>,
    protocol: String,
    tx_hash: Option<String>,
    created_at: DateTime<Utc>,
}

#[derive(Deserialize)]
struct CreateAgent {
    name: String,
    owner: String,
    wallet_address: Option<String>,
    network: Option<String>,
}

#[derive(Deserialize)]
struct UpdateAgentStatus {
    status: String,
}

#[derive(Deserialize)]
struct CreatePolicy {
    name: Option<String>,
    transaction_limit_cents: i64,
    daily_limit_cents: i64,
    approved_merchants: Vec<String>,
    valid_until: Option<DateTime<Utc>>,
}

#[derive(Deserialize)]
struct CreatePayment {
    agent_id: Uuid,
    merchant: String,
    purpose: Option<String>,
    amount_cents: i64,
}

#[derive(Serialize)]
struct ApiError {
    error: String,
}

type ApiResult<T> = Result<Json<T>, (StatusCode, Json<ApiError>)>;

fn api_error(status: StatusCode, message: impl Into<String>) -> (StatusCode, Json<ApiError>) {
    (status, Json(ApiError { error: message.into() }))
}

fn internal_error<E: std::fmt::Display>(error: E) -> (StatusCode, Json<ApiError>) {
    tracing::error!(error = %error, "request failed");
    api_error(StatusCode::INTERNAL_SERVER_ERROR, "An internal server error occurred")
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "service": "oncredsync-api", "mode": "database-backed-demo" }))
}

async fn list_agents(State(state): State<AppState>) -> ApiResult<Vec<Agent>> {
    let rows = sqlx::query_as::<_, Agent>(
        "SELECT id, name, owner, did, wallet_address, network, status, created_at, updated_at FROM agents ORDER BY created_at DESC"
    ).fetch_all(&state.db).await.map_err(internal_error)?;
    Ok(Json(rows))
}

async fn create_agent(
    State(state): State<AppState>,
    Json(input): Json<CreateAgent>,
) -> ApiResult<Agent> {
    let name = input.name.trim();
    let owner = input.owner.trim();
    if name.is_empty() || name.len() > 100 || owner.is_empty() || owner.len() > 120 {
        return Err(api_error(StatusCode::BAD_REQUEST, "Name and owner are required and must be within the allowed length."));
    }
    let id = Uuid::new_v4();
    // This is an application identifier, not a cryptographically verified DID.
    let did = format!("did:oncredsync:{}", id);
    let network = input.network.unwrap_or_else(|| "Base Sepolia".to_string());
    let row = sqlx::query_as::<_, Agent>(
        "INSERT INTO agents (id, name, owner, did, wallet_address, network) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, owner, did, wallet_address, network, status, created_at, updated_at"
    )
    .bind(id).bind(name).bind(owner).bind(did).bind(input.wallet_address).bind(network)
    .fetch_one(&state.db).await.map_err(internal_error)?;
    let _ = sqlx::query("INSERT INTO audit_events (event_type, resource_type, resource_id, details) VALUES ('agent.created', 'agent', $1, $2)")
        .bind(row.id.to_string()).bind(json!({"name": row.name, "owner": row.owner}))
        .execute(&state.db).await;
    Ok(Json(row))
}

async fn update_agent_status(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateAgentStatus>,
) -> ApiResult<Agent> {
    let status = input.status.to_lowercase();
    if !["active", "paused", "revoked"].contains(&status.as_str()) {
        return Err(api_error(StatusCode::BAD_REQUEST, "Status must be active, paused, or revoked."));
    }
    let row = sqlx::query_as::<_, Agent>(
        "UPDATE agents SET status = $2, updated_at = now() WHERE id = $1 RETURNING id, name, owner, did, wallet_address, network, status, created_at, updated_at"
    ).bind(id).bind(&status).fetch_optional(&state.db).await.map_err(internal_error)?
      .ok_or_else(|| api_error(StatusCode::NOT_FOUND, "Agent not found."))?;
    let _ = sqlx::query("INSERT INTO audit_events (event_type, resource_type, resource_id, details) VALUES ('agent.status_changed', 'agent', $1, $2)")
        .bind(id.to_string()).bind(json!({"status": status})).execute(&state.db).await;
    Ok(Json(row))
}

async fn list_policies(State(state): State<AppState>, Path(agent_id): Path<Uuid>) -> ApiResult<Vec<Policy>> {
    let rows = sqlx::query_as::<_, Policy>(
        "SELECT id, agent_id, name, transaction_limit_cents, daily_limit_cents, approved_merchants, valid_until, revoked, created_at, updated_at FROM spending_policies WHERE agent_id = $1 ORDER BY created_at DESC"
    ).bind(agent_id).fetch_all(&state.db).await.map_err(internal_error)?;
    Ok(Json(rows))
}

async fn create_policy(
    State(state): State<AppState>,
    Path(agent_id): Path<Uuid>,
    Json(input): Json<CreatePolicy>,
) -> ApiResult<Policy> {
    if input.transaction_limit_cents <= 0 || input.daily_limit_cents <= 0 {
        return Err(api_error(StatusCode::BAD_REQUEST, "Spending limits must be positive integer cents."));
    }
    if input.approved_merchants.is_empty() {
        return Err(api_error(StatusCode::BAD_REQUEST, "At least one approved merchant is required."));
    }
    let exists: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM agents WHERE id = $1")
        .bind(agent_id).fetch_optional(&state.db).await.map_err(internal_error)?;
    if exists.is_none() {
        return Err(api_error(StatusCode::NOT_FOUND, "Agent not found."));
    }
    let merchants: Vec<String> = input.approved_merchants.iter()
        .map(|m| m.trim().to_lowercase()).filter(|m| !m.is_empty()).collect();
    if merchants.is_empty() {
        return Err(api_error(StatusCode::BAD_REQUEST, "Approved merchant entries cannot be blank."));
    }
    let name = input.name.unwrap_or_else(|| "Default policy".to_string());
    let row = sqlx::query_as::<_, Policy>(
        "INSERT INTO spending_policies (agent_id, name, transaction_limit_cents, daily_limit_cents, approved_merchants, valid_until) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, agent_id, name, transaction_limit_cents, daily_limit_cents, approved_merchants, valid_until, revoked, created_at, updated_at"
    ).bind(agent_id).bind(name.trim()).bind(input.transaction_limit_cents)
     .bind(input.daily_limit_cents).bind(merchants).bind(input.valid_until)
     .fetch_one(&state.db).await.map_err(internal_error)?;
    let _ = sqlx::query("INSERT INTO audit_events (event_type, resource_type, resource_id, details) VALUES ('policy.created', 'policy', $1, $2)")
        .bind(row.id.to_string()).bind(json!({"agent_id": agent_id, "name": row.name}))
        .execute(&state.db).await;
    Ok(Json(row))
}

async fn list_payments(State(state): State<AppState>) -> ApiResult<Vec<Payment>> {
    let rows = sqlx::query_as::<_, Payment>(
        "SELECT id, agent_id, merchant, purpose, amount_cents, status, rejection_reason, protocol, tx_hash, created_at FROM payments ORDER BY created_at DESC LIMIT 200"
    ).fetch_all(&state.db).await.map_err(internal_error)?;
    Ok(Json(rows))
}

async fn create_payment(
    State(state): State<AppState>,
    Json(input): Json<CreatePayment>,
) -> ApiResult<Payment> {
    let merchant = input.merchant.trim().to_lowercase();
    let purpose = input.purpose.unwrap_or_default();
    if merchant.is_empty() || merchant.len() > 200 || input.amount_cents <= 0 {
        return Err(api_error(StatusCode::BAD_REQUEST, "Merchant is required and amount_cents must be a positive integer."));
    }

    let agent = sqlx::query_as::<_, Agent>(
        "SELECT id, name, owner, did, wallet_address, network, status, created_at, updated_at FROM agents WHERE id = $1"
    ).bind(input.agent_id).fetch_optional(&state.db).await.map_err(internal_error)?;
    let Some(agent) = agent else {
        return Err(api_error(StatusCode::NOT_FOUND, "Agent not found."));
    };

    let policy = sqlx::query_as::<_, Policy>(
        "SELECT id, agent_id, name, transaction_limit_cents, daily_limit_cents, approved_merchants, valid_until, revoked, created_at, updated_at FROM spending_policies WHERE agent_id = $1 AND revoked = false ORDER BY created_at DESC LIMIT 1"
    ).bind(input.agent_id).fetch_optional(&state.db).await.map_err(internal_error)?;

    let mut rejection: Option<String> = None;
    if agent.status != "active" {
        rejection = Some(format!("Agent status is {}.", agent.status));
    } else if let Some(ref policy) = policy {
        if policy.valid_until.is_some_and(|expiry| expiry <= Utc::now()) {
            rejection = Some("Spending policy has expired.".to_string());
        } else if input.amount_cents > policy.transaction_limit_cents {
            rejection = Some("Payment exceeds the per-transaction limit.".to_string());
        } else if !policy.approved_merchants.iter().any(|m| m.eq_ignore_ascii_case(&merchant)) {
            rejection = Some("Merchant is not on the approved allowlist.".to_string());
        } else {
            let daily_spend: (i64,) = sqlx::query_as(
                "SELECT COALESCE(SUM(amount_cents), 0)::bigint FROM payments WHERE agent_id = $1 AND status = 'settled' AND created_at >= date_trunc('day', now())"
            ).bind(input.agent_id).fetch_one(&state.db).await.map_err(internal_error)?;
            if daily_spend.0.saturating_add(input.amount_cents) > policy.daily_limit_cents {
                rejection = Some("Payment would exceed the daily spending limit.".to_string());
            }
        }
    } else {
        rejection = Some("No active spending policy is configured for this agent.".to_string());
    }

    // Demo mode records an approval decision only. It does not transfer funds or settle an x402 payment.
    let status = if rejection.is_some() { "rejected" } else { "pending" };
    let row = sqlx::query_as::<_, Payment>(
        "INSERT INTO payments (agent_id, merchant, purpose, amount_cents, status, rejection_reason, protocol) VALUES ($1, $2, $3, $4, $5, $6, 'demo') RETURNING id, agent_id, merchant, purpose, amount_cents, status, rejection_reason, protocol, tx_hash, created_at"
    ).bind(input.agent_id).bind(merchant).bind(purpose).bind(input.amount_cents)
     .bind(status).bind(rejection.clone()).fetch_one(&state.db).await.map_err(internal_error)?;

    let _ = sqlx::query("INSERT INTO audit_events (event_type, resource_type, resource_id, details) VALUES ($1, 'payment', $2, $3)")
        .bind(if rejection.is_some() { "payment.rejected" } else { "payment.pending" })
        .bind(row.id.to_string())
        .bind(json!({"agent_id": row.agent_id, "merchant": row.merchant, "amount_cents": row.amount_cents, "reason": rejection}))
        .execute(&state.db).await;
    Ok(Json(row))
}

async fn list_audit_events(State(state): State<AppState>) -> ApiResult<Vec<serde_json::Value>> {
    let rows = sqlx::query_as::<_, (Uuid, String, String, Option<String>, serde_json::Value, DateTime<Utc>)>(
        "SELECT id, event_type, resource_type, resource_id, details, created_at FROM audit_events ORDER BY created_at DESC LIMIT 200"
    ).fetch_all(&state.db).await.map_err(internal_error)?;
    let events = rows.into_iter().map(|(id, event_type, resource_type, resource_id, details, created_at)| {
        json!({"id": id, "event_type": event_type, "resource_type": resource_type, "resource_id": resource_id, "details": details, "created_at": created_at})
    }).collect::<Vec<_>>();
    Ok(Json(events))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .init();

    let database_url = env::var("DATABASE_URL")
        .map_err(|_| "DATABASE_URL is required; copy .env.example to .env and configure PostgreSQL")?;
    let pool = PgPoolOptions::new().max_connections(10).connect(&database_url).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;

    let origin = env::var("FRONTEND_ORIGIN").unwrap_or_else(|_| "http://localhost:5173".to_string());
    let origin = origin.parse::<HeaderValue>()?;
    let cors = CorsLayer::new()
        .allow_origin(origin)
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION]);

    let state = AppState { db: pool };
    let app = Router::new()
        .route("/health", get(health))
        .route("/api/v1/agents", get(list_agents).post(create_agent))
        .route("/api/v1/agents/:id/status", patch(update_agent_status))
        .route("/api/v1/agents/:agent_id/policies", get(list_policies).post(create_policy))
        .route("/api/v1/payments", get(list_payments).post(create_payment))
        .route("/api/v1/audit-events", get(list_audit_events))
        .with_state(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let host = env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port: u16 = env::var("PORT").unwrap_or_else(|_| "8080".to_string()).parse()?;
    let addr = SocketAddr::new(host.parse()?, port);
    tracing::info!(%addr, "OnCredSync API listening");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
