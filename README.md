# OnCredSync
**Enabling secure autonomous AI payments through decentralized identity.**

OnCredSync is a prototype for AI-agent identity references, programmable spending policies, and auditable payment decisions.

## Repository layout
- `frontend/` — React, TypeScript, and Vite dashboard.
- `backend/` — Rust, Axum, SQLx, and MySQL API.
- `backend/migrations/` — SQL schema migrations applied at backend startup.
- `.github/workflows/ci.yml` — frontend build and backend compile checks.

## Prerequisites
- Node.js 22 or another version supported by the frontend lockfile.
- Rust toolchain (stable).
- MySQL 8.

## Run locally
### 1. Configure MySQL
Create a database and a dedicated local development user in MySQL. Do not commit credentials.
```sql
CREATE DATABASE oncredsync;
CREATE USER 'oncredsync_user'@'localhost' IDENTIFIED BY 'REPLACE_WITH_A_LOCAL_PASSWORD';
GRANT ALL PRIVILEGES ON oncredsync.* TO 'oncredsync_user'@'localhost';
```
In `backend/`, copy `.env.example` to `.env` and set `DATABASE_URL`, for example:
```dotenv
DATABASE_URL=mysql://oncredsync_user:REPLACE_WITH_A_LOCAL_PASSWORD@127.0.0.1:3306/oncredsync
HOST=127.0.0.1
PORT=8080
FRONTEND_ORIGIN=http://localhost:5173
```
Use a URL-encoded password if it contains reserved URL characters. Keep `.env` private. The backend applies SQLx migrations on startup.

### 2. Start the backend
```bash
cd backend
cargo run
```
Check `http://127.0.0.1:8080/health`. A healthy local setup reports a connected database.

### 3. Start the frontend
In a second terminal:
```bash
cd frontend
npm ci
npm run dev
```
Open `http://localhost:5173`. Configure the frontend API base URL with `VITE_API_BASE_URL`; the example points to `http://127.0.0.1:8080`.

## API overview
- `GET /health`
- `GET, POST /api/v1/agents`
- `PATCH /api/v1/agents/:id/status`
- `GET, POST /api/v1/agents/:agent_id/policies`
- `GET, POST /api/v1/payments`
- `GET /api/v1/audit-events`

All transaction and spending-policy amounts are denominated in ETH. The API accepts and returns wei as decimal strings (`1 ETH = 10^18 wei`) so the frontend and backend avoid floating-point arithmetic for stored balances. MySQL stores wei values in `DECIMAL(65,0)`, and the UI converts to ETH only for display.

## Current implementation and limitations
The dashboard reads and writes agents, spending policies, payment-decision records, and audit events through the Rust API backed by MySQL. Payment requests use ETH amounts, stored and validated in wei. Payment requests are evaluated against agent status and policy limits. Approved requests are recorded as **pending demo decisions**, not settled transfers. The UI labels this as demo activity; no wallet is signed and no ETH moves on Base Sepolia.

**This is not production-ready and must not be used to authorize real funds.** There is currently no authentication or authorization layer, cryptographically verified decentralized identity, wallet signing, live x402 verification/settlement, or smart-contract enforcement. Concurrent payment requests need transactional protection around daily-limit checks. Audit-write failures should be handled reliably before relying on the audit log for compliance. CI compiles the backend and builds the frontend; it does not prove payment security or end-to-end correctness.

## Development checks
```bash
# Frontend
cd frontend
npm ci
npm run build

# Backend (compile check; database not required)
cd ../backend
cargo check
```
Next milestones: add isolated API/integration tests, enforce spending limits atomically under concurrent requests, add authentication and authorization, and conduct a security review before integrating any real payment rail. Real ETH support would additionally require wallet connection, transaction signing, RPC integration, chain/receipt verification, and explicit testnet-only transaction handling.
