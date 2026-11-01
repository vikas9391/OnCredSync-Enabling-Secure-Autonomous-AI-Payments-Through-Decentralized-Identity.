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

Set `DATABASE_URL` to the local MySQL connection, `HOST=127.0.0.1`, `PORT=8080`, and `FRONTEND_ORIGIN=http://localhost:5173`. Set a fresh random `JWT_SECRET` of at least 32 characters. Set `BOOTSTRAP_ADMIN_EMAIL` and a unique `BOOTSTRAP_ADMIN_PASSWORD` (12–72 bytes). URL-encode reserved characters in the MySQL password (for example `@` as `%40`, `/` as `%2F`, `#` as `%23`).

Generate a fresh JWT secret in PowerShell:

```powershell
$bytes = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$jwt = [Convert]::ToBase64String($bytes)
$jwt
```

Do not commit `.env`. SQLx migrations are applied automatically when the backend starts. Back up existing data before migration. If the bootstrap email already exists, startup does not replace its password; use that account's existing password. Remove `BOOTSTRAP_ADMIN_PASSWORD` from `.env` after first successful setup/login.

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

- `POST /api/v1/auth/login`: email/password to JWT.
- `GET /api/v1/auth/me`: current user, requires Bearer token.
- `PATCH /api/v1/auth/profile`: update profile.
- `GET/POST /api/v1/auth/users`: list/provision accounts (admin only).
- `PATCH /api/v1/auth/users/:id`: update role/status (admin only).
- `GET/POST /api/v1/auth/workspaces`: workspace listing/creation.

There is no public registration. Sign in with the bootstrap Super Admin, create a workspace, then provision a Workspace Admin or other workspace account. Super Admin has no tenant workspace and cannot browse tenant business records directly.

## Troubleshooting

- **401 at login:** verify email/password and confirm the configured bootstrap email was not already in `users` with a different password. Bootstrap does not reset existing accounts.
- **500 at login:** inspect backend logs; verify migrations completed and MySQL user privileges are sufficient.
- **CORS error:** `FRONTEND_ORIGIN` must exactly match browser origin; `localhost` and `127.0.0.1` are different origins.
- **Network error:** make sure backend is listening on `127.0.0.1:8080`, frontend API URL matches, and both processes remain running.
- **MySQL access denied:** test `mysql -h 127.0.0.1 -u oncredsync_user -p oncredsync`.

This is a development prototype, not a production payment authorization system. All payment decisions are simulated; no funds move.