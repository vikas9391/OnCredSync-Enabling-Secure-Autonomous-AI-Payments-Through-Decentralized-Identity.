# OnCredSync Rust API

Axum REST API with MySQL persistence, SQLx migrations, JWT authentication, bcrypt passwords, role-based authorization, and workspace-scoped data access.

## Requirements

- Rust stable toolchain (`rustup`, `cargo`)
- MySQL 8.0+
- Node.js 22+ and npm for the frontend

## Local setup (Windows PowerShell)

### 1. Create the database and local account

Start MySQL 8.0, then run:

```sql
CREATE DATABASE IF NOT EXISTS oncredsync CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'oncredsync_user'@'localhost' IDENTIFIED BY 'CHOOSE_A_LOCAL_PASSWORD';
ALTER USER 'oncredsync_user'@'localhost' IDENTIFIED BY 'CHOOSE_A_LOCAL_PASSWORD';
GRANT ALL PRIVILEGES ON oncredsync.* TO 'oncredsync_user'@'localhost';
CREATE USER IF NOT EXISTS 'oncredsync_user'@'127.0.0.1' IDENTIFIED BY 'CHOOSE_A_LOCAL_PASSWORD';
ALTER USER 'oncredsync_user'@'127.0.0.1' IDENTIFIED BY 'CHOOSE_A_LOCAL_PASSWORD';
GRANT ALL PRIVILEGES ON oncredsync.* TO 'oncredsync_user'@'127.0.0.1';
FLUSH PRIVILEGES;
```

### 2. Configure backend environment

```powershell
cd backend
Copy-Item .env.example .env
notepad .env
```

Set `DATABASE_URL` to the local MySQL connection, `HOST=127.0.0.1`, `PORT=8080`, and `FRONTEND_ORIGIN=http://localhost:5173`. Set a fresh random `JWT_SECRET` of at least 32 characters. URL-encode reserved characters in the MySQL password (for example `@` as `%40`, `/` as `%2F`, `#` as `%23`).

Generate a fresh JWT secret in PowerShell:

```powershell
$bytes = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$jwt = [Convert]::ToBase64String($bytes)
$jwt
```

Do not commit `.env`. SQLx migrations are applied automatically when the backend starts. Back up existing data before migration. In local debug builds (`cargo run`), the backend creates a demo Super Admin if it does not already exist. The demo account is disabled in release builds.

### 3. Start backend

```powershell
cargo run
```

Check `http://127.0.0.1:8080/health` in another terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/health
```

Expected: `status = ok` and `database = connected`.

### 4. Start frontend in a second terminal

```powershell
cd frontend
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Open `http://localhost:5173`. The default API URL is `http://127.0.0.1:8080`; override with `VITE_API_BASE_URL` in `frontend/.env.local` and restart Vite after changes.

## Authentication

- `POST /api/v1/auth/login`: email/password to JWT.\n- `POST /api/v1/auth/register`: creates a workspace and Workspace Admin account, then returns a JWT.
- `GET /api/v1/auth/me`: current user, requires Bearer token.
- `PATCH /api/v1/auth/profile`: update profile.
- `GET/POST /api/v1/auth/users`: list/provision accounts (admin only).
- `PATCH /api/v1/auth/users/:id`: update role/status (admin only).
- `GET/POST /api/v1/auth/workspaces`: workspace listing/creation.

Public registration creates a new workspace and its first Workspace Admin; the account is stored in MySQL and signed in automatically. For local development only, `cargo run` creates `admin@oncredsync.local` with password `OnCredSync-Local-Admin-2026!` if that account does not exist. This fixed demo credential is compiled only into debug builds; never expose a debug server publicly or deploy it. Super Admin has no tenant workspace and cannot browse tenant business records directly.

## Troubleshooting

- **401 at login:** verify email/password and check that the account exists and is active in `users`. The local demo Super Admin is only created in debug builds and is not reset if it already exists.
- **500 at login:** inspect backend logs; verify migrations completed and MySQL user privileges are sufficient.
- **CORS error:** `FRONTEND_ORIGIN` must exactly match browser origin; `localhost` and `127.0.0.1` are different origins.
- **Network error:** make sure backend is listening on `127.0.0.1:8080`, frontend API URL matches, and both processes remain running.
- **MySQL access denied:** test `mysql -h 127.0.0.1 -u oncredsync_user -p oncredsync`.

This is a development prototype, not a production payment authorization system. All payment decisions are simulated; no funds move.