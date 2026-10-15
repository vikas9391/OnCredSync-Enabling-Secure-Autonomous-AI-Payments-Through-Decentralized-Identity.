mod auth;
use axum::{
    extract::{Path, State},
    http::{header, HeaderValue, Method, StatusCode},
    middleware,
    routing::{get, patch},
    Extension, Json, Router,
};
use chrono::{DateTime, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{mysql::MySqlPoolOptions, FromRow, MySqlPool};
use std::{env, net::SocketAddr};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::EnvFilter;
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    db: MySqlPool,
}

#[derive(Debug, Serialize, FromRow)]
struct Agent {
    id: String,
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
    id: String,
    agent_id: String,
    name: String,
    transaction_limit_wei: String,
    daily_limit_wei: String,
    approved_merchants: Value,
    valid_until: Option<DateTime<Utc>>,
    revoked: bool,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
struct Payment {
    id: String,
    agent_id: String,
    merchant: String,
    purpose: String,
    amount_wei: String,
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
    transaction_limit_wei: String,
    daily_limit_wei: String,
    approved_merchants: Vec<String>,
    valid_until: Option<DateTime<Utc>>,
}

#[derive(Deserialize)]
struct CreatePayment {
    agent_id: String,
    merchant: String,
    purpose: Option<String>,
    amount_wei: String,
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

fn valid_uuid(value: &str) -> bool {
    Uuid::parse_str(value).is_ok()
}

fn merchant_list(value: &Value) -> Vec<String> {
    value.as_array()
        .map(|items| items.iter().filter_map(Value::as_str).map(str::to_owned).collect())
        .unwrap_or_default()
}

async fn health(State(state): State<AppState>) -> Json<Value> {
    let db_ok = sqlx::query("SELECT 1").execute(&state.db).await.is_ok();
    Json(json!({
        "status": if db_ok { "ok" } else { "degraded" },
        "service": "oncredsync-api",
        "database": if db_ok { "connected" } else { "unavailable" },
        "mode": "database-backed-demo"
    }))
}

async fn list_agents(State(state): State<AppState>, Extension(claims): Extension<auth::Claims>) -> ApiResult<Vec<Agent>> {
    let workspace_id = claims.workspace_id.as_deref().ok_or_else(|| api_error(StatusCode::FORBIDDEN, "A workspace is required."))?;
    let rows = sqlx::query_as::<_, Agent>(
        "SELECT id, name, owner, did, wallet_address, network, status, created_at, updated_at FROM agents WHERE workspace_id = ? ORDER BY created_at DESC"
    ).bind(workspace_id).fetch_all(&state.db).await.map_err(internal_error)?;
    Ok(Json(rows))
}

async fn create_agent(
    State(state): State<AppState>,
    Extension(claims): Extension<auth::Claims>,
    Json(input): Json<CreateAgent>,
) -> ApiResult<Agent> {
    let name = input.name.trim();
    let owner = input.owner.trim();
    if name.is_empty() || name.len() > 100 || owner.is_empty() || owner.len() > 120 {
        return Err(api_error(StatusCode::BAD_REQUEST, "Name and owner are required and must be within the allowed length."));
    }

    let workspace_id = claims.workspace_id.as_deref().ok_or_else(|| api_error(StatusCode::FORBIDDEN, "A workspace is required."))?;
    let id = Uuid::new_v4().to_string();
    // This is an application identifier, not a cryptographically verified DID.
    let did = format!("did:oncredsync:{id}");
    let network = input.network.unwrap_or_else(|| "Base Sepolia".to_string());
    sqlx::query(
        "INSERT INTO agents (id, workspace_id, name, owner, did, wallet_address, network) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id).bind(workspace_id).bind(name).bind(owner).bind(&did).bind(input.wallet_address).bind(network)
    .execute(&state.db).await.map_err(internal_error)?;

    let row = sqlx::query_as::<_, Agent>(
        "SELECT id, name, owner, did, wallet_address, network, status, created_at, updated_at FROM agents WHERE id = ? AND workspace_id = ?"
    ).bind(&id).bind(workspace_id).fetch_one(&state.db).await.map_err(internal_error)?;

    let _ = sqlx::query(
        "INSERT INTO audit_events (id, event_type, resource_type, resource_id, details) VALUES (?, 'agent.created', 'agent', ?, ?)"
    )
    .bind(Uuid::new_v4().to_string()).bind(&row.id)
    .bind(json!({"name": row.name, "owner": row.owner}))
    .execute(&state.db).await;
    Ok(Json(row))
}

async fn update_agent_status(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Extension(claims): Extension<auth::Claims>,
    Json(input): Json<UpdateAgentStatus>,
) -> ApiResult<Agent> {
    if !valid_uuid(&id) {
        return Err(api_error(StatusCode::BAD_REQUEST, "Agent id must be a UUID."));
    }
    let status = input.status.to_lowercase();
    if !["active", "paused", "revoked"].contains(&status.as_str()) {
        return Err(api_error(StatusCode::BAD_REQUEST, "Status must be active, paused, or revoked."));
    }
    let workspace_id = claims.workspace_id.as_deref().ok_or_else(|| api_error(StatusCode::FORBIDDEN, "A workspace is required."))?;
    let result = sqlx::query("UPDATE agents SET status = ? WHERE id = ? AND workspace_id = ?")
        .bind(&status).bind(&id).bind(workspace_id).execute(&state.db).await.map_err(internal_error)?;
    if result.rows_affected() == 0 {
        let exists: Option<(String,)> = sqlx::query_as("SELECT id FROM agents WHERE id = ? AND workspace_id = ?")
            .bind(&id).bind(workspace_id).fetch_optional(&state.db).await.map_err(internal_error)?;
        if exists.is_none() {
            return Err(api_error(StatusCode::NOT_FOUND, "Agent not found."));
        }
    }
    let row = sqlx::query_as::<_, Agent>(
        "SELECT id, name, owner, did, wallet_address, network, status, created_at, updated_at FROM agents WHERE id = ?"
    ).bind(&id).fetch_one(&state.db).await.map_err(internal_error)?;
    let _ = sqlx::query(
        "INSERT INTO audit_events (id, event_type, resource_type, resource_id, details) VALUES (?, 'agent.status_changed', 'agent', ?, ?)"
    ).bind(Uuid::new_v4().to_string()).bind(&id).bind(json!({"status": status}))
     .execute(&state.db).await;
    Ok(Json(row))
}

async fn list_policies(
    State(state): State<AppState>,
    Path(agent_id): Path<String>,
    Extension(claims): Extension<auth::Claims>,
) -> ApiResult<Vec<Policy>> {
    if !valid_uuid(&agent_id) {
        return Err(api_error(StatusCode::BAD_REQUEST, "Agent id must be a UUID."));
    }
    let rows = sqlx::query_as::<_, Policy>(
        "SELECT id, agent_id, name, CAST(transaction_limit_wei AS CHAR) AS transaction_limit_wei, CAST(daily_limit_wei AS CHAR) AS daily_limit_wei, approved_merchants, valid_until, revoked, created_at, updated_at FROM spending_policies WHERE agent_id = ? AND workspace_id = ? ORDER BY created_at DESC"
    ).bind(agent_id).bind(claims.workspace_id.as_deref().ok_or_else(|| api_error(StatusCode::FORBIDDEN, "A workspace is required."))?).fetch_all(&state.db).await.map_err(internal_error)?;
    Ok(Json(rows))
}

async fn create_policy(
    State(state): State<AppState>,
    Path(agent_id): Path<String>,
    Extension(claims): Extension<auth::Claims>,
    Json(input): Json<CreatePolicy>,
) -> ApiResult<Policy> {
    if !valid_uuid(&agent_id) {
        return Err(api_error(StatusCode::BAD_REQUEST, "Agent id must be a UUID."));
    }
    let workspace_id = claims.workspace_id.as_deref().ok_or_else(|| api_error(StatusCode::FORBIDDEN, "A workspace is required."))?;
    let transaction_limit_wei = input.transaction_limit_wei.parse::<u128>().ok();
    let daily_limit_wei = input.daily_limit_wei.parse::<u128>().ok();
    if transaction_limit_wei.is_none_or(|v| v == 0) || daily_limit_wei.is_none_or(|v| v == 0) {
        return Err(api_error(StatusCode::BAD_REQUEST, "Spending limits must be positive integer wei amounts encoded as decimal strings."));
    }
    if input.approved_merchants.is_empty() {
        return Err(api_error(StatusCode::BAD_REQUEST, "At least one approved merchant is required."));
    }
    let exists: Option<(String,)> = sqlx::query_as("SELECT id FROM agents WHERE id = ? AND workspace_id = ?")
        .bind(&agent_id).bind(workspace_id).fetch_optional(&state.db).await.map_err(internal_error)?;
    if exists.is_none() {
        return Err(api_error(StatusCode::NOT_FOUND, "Agent not found."));
    }
    let merchants: Vec<String> = input.approved_merchants.iter()
        .map(|m| m.trim().to_lowercase()).filter(|m| !m.is_empty()).collect();
    if merchants.is_empty() {
        return Err(api_error(StatusCode::BAD_REQUEST, "Approved merchant entries cannot be blank."));
    }

    let id = Uuid::new_v4().to_string();
    let name = input.name.unwrap_or_else(|| "Default policy".to_string());
    sqlx::query(
        "INSERT INTO spending_policies (id, workspace_id, agent_id, name, transaction_limit_wei, daily_limit_wei, approved_merchants, valid_until) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(&id).bind(workspace_id).bind(&agent_id).bind(name.trim())
     .bind(input.transaction_limit_wei.trim()).bind(input.daily_limit_wei.trim())
     .bind(json!(merchants)).bind(input.valid_until)
     .execute(&state.db).await.map_err(internal_error)?;

    let row = sqlx::query_as::<_, Policy>(
        "SELECT id, agent_id, name, CAST(transaction_limit_wei AS CHAR) AS transaction_limit_wei, CAST(daily_limit_wei AS CHAR) AS daily_limit_wei, approved_merchants, valid_until, revoked, created_at, updated_at FROM spending_policies WHERE id = ? AND workspace_id = ?"
    ).bind(&id).bind(workspace_id).fetch_one(&state.db).await.map_err(internal_error)?;
    let _ = sqlx::query(
        "INSERT INTO audit_events (id, event_type, resource_type, resource_id, details) VALUES (?, 'policy.created', 'policy', ?, ?)"
    ).bind(Uuid::new_v4().to_string()).bind(&row.id)
     .bind(json!({"agent_id": agent_id, "name": row.name}))
     .execute(&state.db).await;
    Ok(Json(row))
}

async fn list_payments(State(state): State<AppState>, Extension(claims): Extension<auth::Claims>) -> ApiResult<Vec<Payment>> {
    let workspace_id = claims.workspace_id.as_deref().ok_or_else(|| api_error(StatusCode::FORBIDDEN, "A workspace is required."))?;
    let rows = sqlx::query_as::<_, Payment>(
        "SELECT id, agent_id, merchant, purpose, CAST(amount_wei AS CHAR) AS amount_wei, status, rejection_reason, protocol, tx_hash, created_at FROM payments WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 200"
    ).bind(workspace_id).fetch_all(&state.db).await.map_err(internal_error)?;
    Ok(Json(rows))
}

async fn create_payment(
    State(state): State<AppState>,
    Extension(claims): Extension<auth::Claims>,
    Json(input): Json<CreatePayment>,
) -> ApiResult<Payment> {
    if !valid_uuid(&input.agent_id) {
        return Err(api_error(StatusCode::BAD_REQUEST, "agent_id must be a UUID."));
    }
    let workspace_id = claims.workspace_id.as_deref().ok_or_else(|| api_error(StatusCode::FORBIDDEN, "A workspace is required."))?;
    let merchant = input.merchant.trim().to_lowercase();
    let purpose = input.purpose.unwrap_or_default();
    let amount_wei = input.amount_wei.parse::<u128>().ok();
    if merchant.is_empty() || merchant.len() > 200 || amount_wei.is_none_or(|v| v == 0) {
        return Err(api_error(StatusCode::BAD_REQUEST, "Merchant is required and amount_wei must be a positive integer string."));
    }

    let agent = sqlx::query_as::<_, Agent>(
        "SELECT id, name, owner, did, wallet_address, network, status, created_at, updated_at FROM agents WHERE id = ? AND workspace_id = ?"
    ).bind(&input.agent_id).bind(workspace_id).fetch_optional(&state.db).await.map_err(internal_error)?;
    let Some(agent) = agent else {
        return Err(api_error(StatusCode::NOT_FOUND, "Agent not found."));
    };

    let policy = sqlx::query_as::<_, Policy>(
        "SELECT id, agent_id, name, CAST(transaction_limit_wei AS CHAR) AS transaction_limit_wei, CAST(daily_limit_wei AS CHAR) AS daily_limit_wei, approved_merchants, valid_until, revoked, created_at, updated_at FROM spending_policies WHERE agent_id = ? AND workspace_id = ? AND revoked = FALSE ORDER BY created_at DESC LIMIT 1"
    ).bind(&input.agent_id).bind(workspace_id).fetch_optional(&state.db).await.map_err(internal_error)?;

    let mut rejection: Option<String> = None;
    if agent.status != "active" {
        rejection = Some(format!("Agent status is {}.", agent.status));
    } else if let Some(ref policy) = policy {
        if policy.valid_until.is_some_and(|expiry| expiry <= Utc::now()) {
            rejection = Some("Spending policy has expired.".to_string());
        } else if amount_wei.unwrap() > policy.transaction_limit_wei.parse::<u128>().unwrap_or(0) {
            rejection = Some("Payment exceeds the per-transaction limit.".to_string());
        } else if !merchant_list(&policy.approved_merchants).iter().any(|m| m.eq_ignore_ascii_case(&merchant)) {
            rejection = Some("Merchant is not on the approved allowlist.".to_string());
        } else {
            let now = Utc::now();
            let midnight = now.date_naive().and_time(NaiveTime::MIN).and_utc();
            let daily_spend: (String,) = sqlx::query_as(
                "SELECT CAST(COALESCE(SUM(amount_wei), 0) AS CHAR) FROM payments WHERE agent_id = ? AND workspace_id = ? AND status IN ('settled', 'pending') AND created_at >= ?"
            ).bind(&input.agent_id).bind(workspace_id).bind(midnight).fetch_one(&state.db).await.map_err(internal_error)?;
            let spent_wei = daily_spend.0.parse::<u128>().unwrap_or(u128::MAX);
            if spent_wei.saturating_add(amount_wei.unwrap()) > policy.daily_limit_wei.parse::<u128>().unwrap_or(0) {
                rejection = Some("Payment would exceed the daily spending limit.".to_string());
            }
        }
    } else {
        rejection = Some("No active spending policy is configured for this agent.".to_string());
    }

    // Demo mode records a decision only; it does not transfer funds or settle an x402 payment.
    let status = if rejection.is_some() { "rejected" } else { "pending" };
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO payments (id, workspace_id, agent_id, merchant, purpose, amount_wei, status, rejection_reason, protocol) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'demo')"
    ).bind(&id).bind(workspace_id).bind(&input.agent_id).bind(&merchant).bind(&purpose)
     .bind(input.amount_wei.trim()).bind(status).bind(rejection.clone())
     .execute(&state.db).await.map_err(internal_error)?;
    let row = sqlx::query_as::<_, Payment>(
        "SELECT id, agent_id, merchant, purpose, CAST(amount_wei AS CHAR) AS amount_wei, status, rejection_reason, protocol, tx_hash, created_at FROM payments WHERE id = ? AND workspace_id = ?"
    ).bind(&id).bind(workspace_id).fetch_one(&state.db).await.map_err(internal_error)?;

    let _ = sqlx::query(
        "INSERT INTO audit_events (id, event_type, resource_type, resource_id, details) VALUES (?, ?, 'payment', ?, ?)"
    ).bind(Uuid::new_v4().to_string())
     .bind(if rejection.is_some() { "payment.rejected" } else { "payment.pending" })
     .bind(&row.id)
     .bind(json!({"agent_id": row.agent_id, "merchant": row.merchant, "amount_wei": row.amount_wei, "reason": rejection}))
     .execute(&state.db).await;
    Ok(Json(row))
}

async fn list_audit_events(State(state): State<AppState>, Extension(claims): Extension<auth::Claims>) -> ApiResult<Vec<Value>> {
    let workspace_id = claims.workspace_id.as_deref().ok_or_else(|| api_error(StatusCode::FORBIDDEN, "A workspace is required."))?;
    let rows = sqlx::query_as::<_, (String, String, String, Option<String>, Value, DateTime<Utc>)>(
        "SELECT id, event_type, resource_type, resource_id, details, created_at FROM audit_events WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 200"
    ).bind(workspace_id).fetch_all(&state.db).await.map_err(internal_error)?;
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
        .map_err(|_| "DATABASE_URL is required; copy .env.example to .env and configure MySQL")?;
    let pool = MySqlPoolOptions::new().max_connections(10).connect(&database_url).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;

    let origin = env::var("FRONTEND_ORIGIN").unwrap_or_else(|_| "http://localhost:5173".to_string());
    let origin = origin.parse::<HeaderValue>()?;
    let cors = CorsLayer::new()
        .allow_origin(origin)
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION]);

    let jwt_secret = env::var("JWT_SECRET")
        .map_err(|_| "JWT_SECRET is required; use a random secret of at least 32 characters")?;
    if jwt_secret.len() < 32 {
        return Err("JWT_SECRET must contain at least 32 characters".into());
    }
    auth::bootstrap_super_admin(&pool, &jwt_secret).await?;
    let state = AppState { db: pool.clone() };
    let auth_state = auth::AuthState { db: pool.clone(), jwt_secret };

    // All business API routes require a valid session and pass a server-side role check.
    let protected_api = Router::new()
        .route("/api/v1/agents", get(list_agents).post(create_agent))
        .route("/api/v1/agents/:id/status", patch(update_agent_status))
        .route("/api/v1/agents/:agent_id/policies", get(list_policies).post(create_policy))
        .route("/api/v1/payments", get(list_payments).post(create_payment))
        .route("/api/v1/audit-events", get(list_audit_events))
        .route_layer(middleware::from_fn_with_state(auth_state.clone(), auth::authorize_api))
        .with_state(state.clone());

    let app = Router::new()
        .route("/health", get(health))
        .with_state(state)
        .merge(protected_api)
        .merge(auth::router(auth_state))
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


#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn accepts_valid_uuid() {
        assert!(valid_uuid("550e8400-e29b-41d4-a716-446655440000"));
    }

    #[test]
    fn rejects_invalid_uuid() {
        assert!(!valid_uuid(""));
        assert!(!valid_uuid("not-a-uuid"));
    }

    #[test]
    fn reads_string_merchants_from_json_array() {
        let merchants = merchant_list(&json!(["OpenAI", "Example Store"]));
        assert_eq!(merchants, vec!["OpenAI", "Example Store"]);
    }

    #[test]
    fn ignores_non_string_entries_in_merchant_json() {
        let merchants = merchant_list(&json!(["OpenAI", 42, null, true]));
        assert_eq!(merchants, vec!["OpenAI"]);
    }

    #[test]
    fn non_array_merchant_json_returns_empty_list() {
        assert!(merchant_list(&json!({"merchant": "OpenAI"})).is_empty());
        assert!(merchant_list(&json!(null)).is_empty());
    }
}
