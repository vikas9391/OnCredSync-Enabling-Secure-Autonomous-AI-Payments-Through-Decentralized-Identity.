# OnCredSync Solidity contracts

Solidity 0.8.24 contracts for a testnet-first prototype.

## Contracts

- AgentRegistry: owner-controlled agent ID and DID-hash registry, with active/inactive state.
- SpendingPolicy: transaction and daily limits, merchant allowlisting, expiry, revocation and authorization accounting.

## Build with Foundry

Install Foundry, then run from this directory:

```bash
forge build
forge test
```

## Important security scope

These contracts are starter primitives, not a production payment system. AgentRegistry stores a DID hash and does not resolve or validate a standards-compliant DID document. SpendingPolicy does not transfer tokens and is not an x402 facilitator. The owner/executor role must be secured, and policy checks must be correctly coordinated with payment verification and settlement. Add tests, threat modeling, external review and deployment configuration before using real funds.
