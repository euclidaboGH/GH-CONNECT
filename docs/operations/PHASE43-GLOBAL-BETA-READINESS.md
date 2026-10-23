# GreenHaven Phase 43 — Global Beta Readiness

## Objective
Move GreenHaven from source-level Testnet E2E readiness toward controlled beta operations without treating configuration as evidence.

## Gates
- Foundation health/readiness
- Node 24 production execution
- Pi Testnet multi-user evidence
- Structured redacted observability
- Database backup/restore rehearsal
- Application/database rollback rehearsal
- Financial/provider kill-switch verification
- Named incident owner and support escalation

## Safety rules
1. No production deployment is performed by this phase.
2. Financial features remain disabled until independent evidence and operator approval exist.
3. Testnet evidence must use real Testnet identities; no fabricated balances, payments or entitlements.
4. Logs must never contain secrets, payment payloads, private wallet identifiers or raw access tokens.
5. A readiness endpoint reports blockers; it does not approve release.

## Required live evidence
- Node 24 `npm ci --legacy-peer-deps`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Phase 42 two-user Testnet run
- backup restore rehearsal
- rollback rehearsal
- kill-switch rehearsal
- alert/observability confirmation
- incident owner confirmation

## Operator sequence
1. Deploy Preview/Testnet only.
2. Run health and beta-readiness endpoints.
3. Run Phase 42 E2E with two accounts.
4. Reconcile identity, payments, membership, marketplace, wallet and messaging evidence.
5. Perform isolated backup/restore rehearsal.
6. Perform rollback rehearsal.
7. Verify kill switches.
8. Collect evidence bundle.
9. Obtain operator approval.
10. Only then proceed to Phase 44 release audit.
