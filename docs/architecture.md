# OnCredSync architecture and implementation status

## Target request flow

1. An organization registers an AI agent and assigns an identity reference.
2. An administrator configures transaction limits, a daily budget, approved merchants and policy expiry.
3. An AI agent requests access to a paid API or service.
4. The Rust API validates the request, checks agent state and obtains a policy decision.
5. In the x402 integration phase, the payment challenge, signed payment payload, facilitator verification and settlement must follow the selected x402 implementation.
6. A successful settlement is recorded with its chain/network reference; rejected requests retain a reason.
7. PostgreSQL supports operational queries and audit views; smart contracts provide on-chain policy evidence where appropriate.

## Implemented in this repository

- React + TypeScript frontend prototype.
- Rust + Axum REST API scaffold.
- PostgreSQL schema and startup migrations.
- Agent registry and spending policy Solidity primitives.

## Not implemented / not production-ready yet

- API authentication, tenant authorization and rate limiting.
- Atomic/concurrency-safe budget reservations and settlement reconciliation.
- Standards-compliant DID document creation/resolution and verifiable credentials.
- A live x402 client/server integration and facilitator verification/settlement.
- Wallet signing, RPC configuration, contract deployment and chain event indexing.
- Automated Rust integration tests, contract tests and frontend end-to-end tests.
- Production deployment and security review.

## Trust boundary

Never treat a frontend decision as authorization. The backend and/or deployed contracts must enforce policies. Never store private keys in source control or expose signing secrets to the frontend. Do not represent a pending payment request as settled until the payment system confirms settlement.
