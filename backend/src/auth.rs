use axum::{
    body::Body,
    extract::{State},
    http::{Method, Request, StatusCode},
    middleware::{self, Next},
    response::Response,
    routing::{get, patch, post},
    Extension, Json, Router,
};
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, MySqlPool};
use std::env;
use uuid::Uuid;

#[derive(Clone)]
pub struct AuthState {
    pub db: MySqlPool,
    pub jwt_secret: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub role: String,
    pub exp: usize,
}

#[derive(Debug, Serialize, FromRow)]
struct User {
    id: String,
    full_name: String,
    email: String,
    role: String,
    status: String,
    created_at: chrono::NaiveDateTime,
}

#[derive(Debug, Serialize)]
struct AuthResponse {
    access_token: String,
    token_type: &'static str,
    expires_in: i64,
    user: User,
}

#[derive(Debug, Deserialize)]
struct LoginInput { email: String, password: String }

#[derive(Debug, Deserialize)]
struct CreateUserInput { full_name: String, email: String, password: String, role: String }

#[derive(Debug, Deserialize)]
struct UpdateRoleInput { role: Option<String>, status: Option<String> }

#[derive(Debug, Deserialize)]
struct UpdateProfileInput { full_name: String }

#[derive(Debug, Serialize)]
struct ErrorBody { error: String }

type AuthResult<T> = Result<Json<T>, (StatusCode, Json<ErrorBody>)>;

fn err(status: StatusCode, message: impl Into<String>) -> (StatusCode, Json<ErrorBody>) {
    (status, Json(ErrorBody { error: message.into() }))
}

fn allowed_role(role: &str) -> bool {
    matches!(role, "workspace_admin" | "finance_manager" | "agent_operator" | "viewer")
}

fn token(claims: Claims, secret: &str) -> Result<String, jsonwebtoken::errors::Error> {
    encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_bytes()))
}

pub fn router(state: AuthState) -> Router {
    let public = Router::new()
        .route("/api/v1/auth/login", post(login))
        .with_state(state.clone());

    let protected = Router::new()
        .route("/api/v1/auth/me", get(me))
        .route("/api/v1/auth/profile", patch(update_profile))
        .route("/api/v1/auth/users", get(list_users).post(create_user))
        .route("/api/v1/auth/users/:id", patch(update_user))
        .route_layer(middleware::from_fn_with_state(state.clone(), require_auth))
        .with_state(state);

    public.merge(protected)
}

async fn login(State(state): State<AuthState>, Json(input): Json<LoginInput>) -> AuthResult<AuthResponse> {
    let email = input.email.trim().to_lowercase();
    if email.is_empty() || input.password.is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "Email and password are required."));
    }
    let row = sqlx::query_as::<_, (String, String, String, String, String, chrono::NaiveDateTime)>(
        "SELECT id, full_name, email, password_hash, role, created_at FROM users WHERE email = ? AND status = 'active' LIMIT 1"
    ).bind(&email).fetch_optional(&state.db).await
      .map_err(|e| { tracing::error!(error=%e, "login query failed"); err(StatusCode::INTERNAL_SERVER_ERROR, "Login is temporarily unavailable.") })?;
    let Some((id, full_name, email, password_hash, role, created_at)) = row else {
        return Err(err(StatusCode::UNAUTHORIZED, "Invalid email or password."));
    };
    if !verify(&input.password, &password_hash).unwrap_or(false) {
        return Err(err(StatusCode::UNAUTHORIZED, "Invalid email or password."));
    }
    let expires = Utc::now() + Duration::hours(8);
    let claims = Claims { sub: id.clone(), email: email.clone(), role: role.clone(), exp: expires.timestamp() as usize };
    let access_token = token(claims, &state.jwt_secret)
        .map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "Could not create session."))?;
    let user = User { id, full_name, email, role, status: "active".into(), created_at };
    Ok(Json(AuthResponse { access_token, token_type: "Bearer", expires_in: 8 * 60 * 60, user }))
}

async fn require_auth(
    State(state): State<AuthState>,
    mut request: Request<Body>,
    next: Next,
) -> Result<Response, (StatusCode, Json<ErrorBody>)> {
    let claims = parse_claims(request.headers(), &state.jwt_secret)?;
    let current = sqlx::query_as::<_, (String, String, String)>(
        "SELECT id, role, status FROM users WHERE id = ?"
    ).bind(&claims.sub).fetch_optional(&state.db).await
      .map_err(|e| { tracing::error!(error=%e, "auth lookup failed"); err(StatusCode::INTERNAL_SERVER_ERROR, "Authentication is temporarily unavailable.") })?;
    let Some((id, role, status)) = current else { return Err(err(StatusCode::UNAUTHORIZED, "Session is no longer valid.")); };
    if status != "active" { return Err(err(StatusCode::FORBIDDEN, "This account is disabled.")); }
    let refreshed = Claims { sub: id, email: claims.email, role, exp: claims.exp };
    request.extensions_mut().insert(refreshed);
    Ok(next.run(request).await)
}

pub async fn authorize_api(
    State(state): State<AuthState>,
    mut request: Request<Body>,
    next: Next,
) -> Result<Response, (StatusCode, Json<ErrorBody>)> {
    let claims = parse_claims(request.headers(), &state.jwt_secret)?;
    let current = sqlx::query_as::<_, (String, String)>("SELECT role, status FROM users WHERE id = ?")
        .bind(&claims.sub).fetch_optional(&state.db).await
        .map_err(|e| { tracing::error!(error=%e, "authorization lookup failed"); err(StatusCode::INTERNAL_SERVER_ERROR, "Authorization is temporarily unavailable.") })?;
    let Some((current_role, status)) = current else { return Err(err(StatusCode::UNAUTHORIZED, "Session is no longer valid.")); };
    if status != "active" { return Err(err(StatusCode::FORBIDDEN, "This account is disabled.")); }
    let claims = Claims { role: current_role, ..claims };
    let path = request.uri().path();
    let method = request.method().clone();
    let role = claims.role.as_str();
    let is_read = method == Method::GET;
    let allowed = if role == "super_admin" || role == "workspace_admin" {
        true
    } else if role == "viewer" {
        is_read
    } else if role == "finance_manager" {
        (is_read && (path.contains("/agents") || path.contains("/payments") || path.contains("/policies") || path.contains("/audit-events")))
            || (method == Method::POST && path.ends_with("/payments"))
    } else if role == "agent_operator" {
        (is_read && (path.contains("/agents") || path.contains("/policies") || path.contains("/payments") || path.contains("/audit-events")))
            || (method == Method::POST && (path.ends_with("/agents") || path.ends_with("/payments") || path.contains("/policies")))
            || (method == Method::PATCH && path.ends_with("/status"))
    } else { false };
    if !allowed { return Err(err(StatusCode::FORBIDDEN, "Your role does not have permission to perform this action.")); }
    request.extensions_mut().insert(claims);
    Ok(next.run(request).await)
}

fn parse_claims(headers: &axum::http::HeaderMap, secret: &str) -> Result<Claims, (StatusCode, Json<ErrorBody>)> {
    let value = headers.get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok()).unwrap_or_default();
    let bearer = value.strip_prefix("Bearer ").ok_or_else(|| err(StatusCode::UNAUTHORIZED, "Sign in to continue."))?;
    decode::<Claims>(bearer, &DecodingKey::from_secret(secret.as_bytes()), &Validation::default())
        .map(|data| data.claims)
        .map_err(|_| err(StatusCode::UNAUTHORIZED, "Session expired or invalid. Please sign in again."))
}

async fn me(State(state): State<AuthState>, Extension(claims): Extension<Claims>) -> AuthResult<User> {
    let user = sqlx::query_as::<_, User>("SELECT id, full_name, email, role, status, created_at FROM users WHERE id = ?")
        .bind(claims.sub).fetch_optional(&state.db).await.map_err(|e| {
            tracing::error!(error=%e, "profile query failed"); err(StatusCode::INTERNAL_SERVER_ERROR, "Could not load profile.")
        })?;
    user.map(Json).ok_or_else(|| err(StatusCode::NOT_FOUND, "User not found."))
}

async fn update_profile(State(state): State<AuthState>, Extension(claims): Extension<Claims>, Json(input): Json<UpdateProfileInput>) -> AuthResult<User> {
    let name = input.full_name.trim();
    if name.is_empty() || name.len() > 120 { return Err(err(StatusCode::BAD_REQUEST, "Name must be between 1 and 120 characters.")); }
    sqlx::query("UPDATE users SET full_name = ? WHERE id = ?").bind(name).bind(&claims.sub)
        .execute(&state.db).await.map_err(|e| { tracing::error!(error=%e, "profile update failed"); err(StatusCode::INTERNAL_SERVER_ERROR, "Could not update profile.") })?;
    me(State(state), Extension(claims)).await
}

async fn list_users(State(state): State<AuthState>, Extension(claims): Extension<Claims>) -> AuthResult<Vec<User>> {
    if claims.role != "super_admin" { return Err(err(StatusCode::FORBIDDEN, "Only the Super Admin can manage platform accounts until workspace isolation is enabled.")); }
    let users = sqlx::query_as::<_, User>("SELECT id, full_name, email, role, status, created_at FROM users ORDER BY created_at DESC")
        .fetch_all(&state.db).await.map_err(|e| { tracing::error!(error=%e, "users query failed"); err(StatusCode::INTERNAL_SERVER_ERROR, "Could not list users.") })?;
    Ok(Json(users))
}

async fn create_user(State(state): State<AuthState>, Extension(claims): Extension<Claims>, Json(input): Json<CreateUserInput>) -> AuthResult<User> {
    if claims.role != "super_admin" { return Err(err(StatusCode::FORBIDDEN, "Only the Super Admin can provision accounts until workspace isolation is enabled.")); }
    let name = input.full_name.trim();
    let email = input.email.trim().to_lowercase();
    if name.is_empty() || name.len() > 120 || !email.contains('@') || input.password.len() < 12 || input.password.len() > 72 {
        return Err(err(StatusCode::BAD_REQUEST, "Enter a valid name and email; passwords must be 12–72 bytes for bcrypt."));
    }
    if !allowed_role(&input.role) && !(claims.role == "super_admin" && input.role == "super_admin") {
        return Err(err(StatusCode::BAD_REQUEST, "Unsupported role."));
    }
    if claims.role != "super_admin" && input.role == "super_admin" { return Err(err(StatusCode::FORBIDDEN, "Only a Super Admin can grant the Super Admin role.")); }
    let password_hash = hash(&input.password, DEFAULT_COST).map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "Could not secure the password."))?;
    let id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO users (id, full_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)")
        .bind(&id).bind(name).bind(&email).bind(password_hash).bind(&input.role)
        .execute(&state.db).await.map_err(|e| {
            if e.to_string().contains("Duplicate") { err(StatusCode::CONFLICT, "An account with that email already exists.") }
            else { tracing::error!(error=%e, "user creation failed"); err(StatusCode::INTERNAL_SERVER_ERROR, "Could not create user.") }
        })?;
    let user = sqlx::query_as::<_, User>("SELECT id, full_name, email, role, status, created_at FROM users WHERE id = ?")
        .bind(id).fetch_one(&state.db).await.map_err(|e| { tracing::error!(error=%e, "created user query failed"); err(StatusCode::INTERNAL_SERVER_ERROR, "User created but could not be loaded.") })?;
    Ok(Json(user))
}

async fn update_user(State(state): State<AuthState>, Extension(claims): Extension<Claims>, axum::extract::Path(id): axum::extract::Path<String>, Json(input): Json<UpdateRoleInput>) -> AuthResult<User> {
    if claims.role != "super_admin" { return Err(err(StatusCode::FORBIDDEN, "Only the Super Admin can manage platform accounts until workspace isolation is enabled.")); }
    if id == claims.sub && (input.status.as_deref() == Some("disabled") || input.role.is_some()) { return Err(err(StatusCode::BAD_REQUEST, "You cannot disable or change the role of your own account.")); }
    if let Some(role) = input.role.as_deref() {
        if !allowed_role(role) && !(claims.role == "super_admin" && role == "super_admin") { return Err(err(StatusCode::BAD_REQUEST, "Unsupported role.")); }
        if claims.role != "super_admin" && role == "super_admin" { return Err(err(StatusCode::FORBIDDEN, "Only a Super Admin can grant the Super Admin role.")); }
        sqlx::query("UPDATE users SET role = ? WHERE id = ?").bind(role).bind(&id).execute(&state.db).await
            .map_err(|e| { tracing::error!(error=%e, "role update failed"); err(StatusCode::INTERNAL_SERVER_ERROR, "Could not update role.") })?;
    }
    if let Some(status) = input.status.as_deref() {
        if !["active", "disabled"].contains(&status) { return Err(err(StatusCode::BAD_REQUEST, "Status must be active or disabled.")); }
        sqlx::query("UPDATE users SET status = ? WHERE id = ?").bind(status).bind(&id).execute(&state.db).await
            .map_err(|e| { tracing::error!(error=%e, "status update failed"); err(StatusCode::INTERNAL_SERVER_ERROR, "Could not update account status.") })?;
    }
    let user = sqlx::query_as::<_, User>("SELECT id, full_name, email, role, status, created_at FROM users WHERE id = ?")
        .bind(id).fetch_optional(&state.db).await.map_err(|e| { tracing::error!(error=%e, "user fetch failed"); err(StatusCode::INTERNAL_SERVER_ERROR, "Could not load user.") })?;
    user.map(Json).ok_or_else(|| err(StatusCode::NOT_FOUND, "User not found."))
}

pub async fn bootstrap_super_admin(pool: &MySqlPool, secret: &str) -> Result<(), Box<dyn std::error::Error>> {
    let email = match env::var("BOOTSTRAP_ADMIN_EMAIL") { Ok(v) => v.trim().to_lowercase(), Err(_) => return Ok(()) };
    let password = match env::var("BOOTSTRAP_ADMIN_PASSWORD") { Ok(v) => v, Err(_) => return Ok(()) };
    let name = env::var("BOOTSTRAP_ADMIN_NAME").unwrap_or_else(|_| "Platform Administrator".into());
    if password.len() < 12 || password.len() > 72 { return Err("BOOTSTRAP_ADMIN_PASSWORD must be 12–72 bytes for bcrypt".into()); }
    let existing: Option<(String,)> = sqlx::query_as("SELECT id FROM users WHERE email = ?").bind(&email).fetch_optional(pool).await?;
    if existing.is_none() {
        let password_hash = hash(password, DEFAULT_COST)?;
        sqlx::query("INSERT INTO users (id, full_name, email, password_hash, role) VALUES (?, ?, ?, ?, 'super_admin')")
            .bind(Uuid::new_v4().to_string()).bind(name.trim()).bind(email).bind(password_hash).execute(pool).await?;
        tracing::info!("Bootstrap Super Admin account created from environment configuration.");
    }
    let _ = secret;
    Ok(())
}
