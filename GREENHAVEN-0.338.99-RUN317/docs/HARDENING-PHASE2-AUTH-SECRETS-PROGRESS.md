# Hardening Phase 2 — Auth, secrets and request protection (DONE in source)

Base: `0.338.86` (after Phase 1 address privacy + CI coverage).  
No version bump. Production remains **NOT APPROVED**.

## Scope complete

### Operator key model
- Per-purpose keys only; multi-env fallback chains fail closed
- 32-byte floor for every purpose
- `GHC_PUBLIC_DIAGNOSTICS` removed
- Purpose helpers: admin, A2U, earnings executor, payout reconcile
- Routes migrated off `A || B || C`

### JWT claims
- `typ` required (`JWT` / `AT+JWT`)
- `iss` + `aud` required when first-party JWT path is used

### CSP
- Full directive set including `script-src` in `vercel.json`

### CSRF / localStorage
- `lib/csrf-protection.ts` rewritten to **cookie double-submit** (`gh_csrf`)
- No CSRF token in localStorage; legacy key cleaned on clear
- Primary defense remains middleware origin + `sec-fetch-site`

### payments/approve
- Purpose mismatch is a **hard 409** (`PURPOSE_MISMATCH`)
- Client no longer receives PI_API_KEY hints, raw provider errors, or env alignment hints
- Durable rate limit: 30/min per user or IP

### Rate limits
- Inventory script: `scripts/check-phase2-mutating-rate-limits.mjs`
- 243 API routes; 19 mutating without rate-limit reference (inventory in script output)
- Added limits: `payments/approve`, `auth/logout`
- Operator/webhook routes remain intentional exceptions pending per-route review

### ID generation
- New `lib/secure-id.ts` (`secureUUID`, `securePrefixedId`, `secureHex`)
- `lib/transactions.ts` and `lib/ghc-data.ts` prefer crypto-strong IDs
- Remaining `Math.random` usages are largely client UI / sampling; continue migration in Phase 4 structure work

## Verification limits
- Source-only. No PostgreSQL execution; no Node 24 typecheck/lint/build in audit workspace.
- Operator key rotation required before deploy (32-byte, per-purpose).
- First-party JWT requires `GHC_AUTH_JWT_ISSUER` + `GHC_AUTH_JWT_AUDIENCE`.
- CSP must be smoke-tested in Pi Browser.

## Operator deploy checklist
1. Set distinct ≥32-byte secrets: `GHC_OPERATOR_RECONCILE_KEY`, `GHC_ADMIN_API_KEY`, `GHC_A2U_ADMIN_KEY`, `PI_EARNINGS_EXECUTOR_KEY`, `GHC_PAYOUT_RECONCILIATION_KEY`
2. Set JWT issuer/audience if using first-party JWTs
3. Do not set `GHC_PUBLIC_DIAGNOSTICS`
4. Smoke CSP + approve flow on Testnet Preview
