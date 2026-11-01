# OnCredSync Frontend

React + TypeScript + Vite client for the OnCredSync Rust API.

## Run locally (Windows PowerShell)

```powershell
cd frontend
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Open `http://localhost:5173`. The API defaults to `http://127.0.0.1:8080`; change `VITE_API_BASE_URL` in `.env.local` if needed and restart Vite.

## Build

```powershell
npm run build
npm run preview
```

Authentication is backed by the Rust API. There is no public sign-up: the bootstrap Super Admin provisions workspace accounts. The access token is held in session storage and attached as a Bearer token. A 401 response clears the local session so the user can sign in again.

All payment activity is simulated; no wallet signatures or real ETH transfers are performed.