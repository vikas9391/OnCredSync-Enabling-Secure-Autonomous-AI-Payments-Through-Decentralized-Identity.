# OnCredSync Frontend

A React + TypeScript + Vite interface prototype for OnCredSync, an AI-agent identity and autonomous-payment policy dashboard.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite (typically http://localhost:5173).

## Production build

```bash
npm run build
npm run preview
```

## Current prototype features

- Responsive command-center dashboard and spend charts.
- Agent listing, registration, pause/resume and local revocation states.
- Spending policy overview and interactive payment-policy simulator.
- Payment history with search and status filtering.
- Demo identity registry and activity timeline.
- Workspace settings and integration status.

## Important scope notes

This is a **frontend-only prototype**. Data is held in React state and resets on refresh. Agent identifiers, transaction hashes, status values and chart data are illustrative. It does not connect to a Rust backend, PostgreSQL, deployed contracts, a DID resolver, wallet signer, or x402 facilitator. The simulator is client-side demonstration logic only and must not be treated as real payment authorization. Backend and smart-contract validation must become authoritative before any real funds are used.
