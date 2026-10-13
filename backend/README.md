# OnCredSync Rust API

Axum REST API and PostgreSQL persistence layer.

## Prerequisites

- Rust stable toolchain
- PostgreSQL 14+
- A database named `oncredsync`

## Run locally (PowerShell)

From the repository root:

```powershell
cd backend
Copy-Item .env.example .env
# Edit .env and set DATABASE_URL for your PostgreSQL instance.
cargo run
```

The service runs on `http://127.0.0.1:8080` by default. SQLx migrations run automatically at startup.

## Endpoints

- `GET /health`
- `GET /api/v1/agents`
- `POST /api/v1/agents`
- `PATCH /api/v1/agents/{id}/status`
- `GET /api/v1/agents/{agent_id}/policies`
- `POST /api/v1/agents/{agent_id}/policies`
- `GET /api/v1/payments`
- `POST /api/v1/payments`
- `GET /api/v1/audit-events`

Amounts use integer cents to avoid floating-point money calculations. For example, USD 3.50 is `350`.

## Quick examples

Create an agent:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8080/api/v1/agents -ContentType 'application/json' -Body '{"name":"Research Agent","owner":"Vikas Labs","network":"Base Sepolia"}'
```

Create a policy using the returned agent UUID:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8080/api/v1/agents/AGENT_UUID/policies -ContentType 'application/json' -Body '{"name":"Research default","transaction_limit_cents":1000,"daily_limit_cents":5000,"approved_merchants":["vector api"]}'
```

Submit a payment-policy request:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8080/api/v1/payments -ContentType 'application/json' -Body '{"agent_id":"AGENT_UUID","merchant":"vector api","purpose":"embedding request","amount_cents":350}'
```

## Current security boundary

This is an initial backend scaffold. There is no user authentication/authorization yet; do not expose it publicly. Payment requests that pass demo policy checks are recorded as `pending`, not settled. No funds move and x402 verification is not implemented yet. Policy evaluation needs transaction-level concurrency protection and integration tests before production use. The generated DID is an application identifier, not a verified decentralized identity.
