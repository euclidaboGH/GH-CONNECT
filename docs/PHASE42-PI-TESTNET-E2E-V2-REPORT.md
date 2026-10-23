# GREENHAVEN — PHASE 42
## Pi Testnet E2E V2

Phase 42 establishes the real Testnet execution contract without fabricating Pi identity, wallet state, payments, balances, entitlements, or transaction outcomes.

### Implemented

- Explicit Testnet-only operator runner.
- Production target refusal.
- Real session-cookie requirement.
- Real two-account isolation support.
- Pi identity/server-session verification.
- Wallet, membership, creator economy, marketplace, messaging, notification/realtime and Daily Claim reachability probes.
- Playwright authenticated Testnet suite.
- Fake payment rejection regression.
- Machine-readable Testnet evidence template.
- CI source contract gate.

### Runtime boundary

This package does not claim that Pi Testnet transactions have been executed. Actual Pi Browser wallet authentication and provider payment confirmation require a real Testnet account, Pi Browser, configured Pi server credentials and deployed Preview/Testnet infrastructure.

### Mandatory execution order

1. Deploy Phase 41 package to Preview/Testnet with Node 24.
2. Authenticate a real Testnet account in Pi Browser.
3. Capture the resulting GreenHaven `gh_session` cookie through the approved operator workflow; never commit it.
4. Run the operator E2E runner.
5. Run the Playwright Phase 42 suite.
6. Execute real Pi payment flows only in Pi Browser.
7. Record evidence in the Phase 42 evidence template.
8. Repeat with a second real account for isolation-sensitive flows.
9. Reconcile database, wallet, membership, order, messaging and notification state after each flow.

No Mainnet production payment testing is authorized by this phase.

### Additional convergence hardening

Phase 42 also removed the last silent formula fallback from curation weighting. The durable `gh_reputation_intelligence` snapshot is now required for curation. If it is unavailable, curation fails closed; if the account is not eligible, the API returns review-required rather than silently applying legacy weight.

### Static verification

- Phase 42 Testnet contract: **43/43 PASS**
- Project integrity: **36/36 PASS, 0 errors, 0 warnings**
- Clean migrations: **131/131**
- Database source contract: **114 executable tables / 131 migrations**
- Migration release readiness: **PASS**

The environment still does not contain the real Node 24 production dependency runtime, Pi Browser wallet, Pi Testnet credentials, or deployed Testnet evidence, so no real payment or wallet transaction is marked passed by this package.
