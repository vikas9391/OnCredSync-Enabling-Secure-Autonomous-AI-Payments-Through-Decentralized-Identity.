# OnCredSync
**Enabling secure autonomous AI payments through decentralized identity.**

OnCredSync is a project to give AI agents portable identity references and programmable spending policies for autonomous payments.

## Repository layout

- `frontend/` — React + TypeScript + Vite dashboard prototype (first implementation phase).
- `backend/` — planned Rust API, x402 coordination and PostgreSQL integration.
- `contracts/` — planned Solidity agent registry and spending-policy contracts.
- `docs/` — architecture and integration notes.

## Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Then open the Vite URL, typically `http://localhost:5173`.

## Current status

The frontend currently uses local illustrative data. It demonstrates agent registration, pause/revoke controls, a client-side payment policy simulator, payment history, identity registry, charts, and workspace preferences.

**Not production-ready:** The user interface is not connected to a Rust backend, PostgreSQL, a DID resolver, smart contracts, a wallet signer, or a live x402 facilitator. The local simulator is not authoritative payment authorization. No live transactions are made. Integrations, tests, and contract security review are required before real-fund use.

## Planned implementation sequence

1. Frontend experience and interaction prototype.
2. Rust API + PostgreSQL data model and migrations.
3. Solidity identity registry and spending-policy enforcement.
4. x402 payment verification/settlement flow and wallet integration.
5. Integration testing, monitoring, security review and deployment.
