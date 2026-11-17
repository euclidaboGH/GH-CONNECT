# Hardening Phase 3 — Verification and supply chain (DONE in source for hardening scope)

Base: `0.338.86` after Phase 2 auth/secrets. Production remains **NOT APPROVED**.

## Done

### Behavioural money/auth contracts
- `scripts/test-phase3-money-auth-behaviour.mjs` — **24/24** static contracts for:
  - `payments/approve` (rate limit, purpose hard-reject, no key/error leakage, unbound gate)
  - JWT `typ`/`iss`/`aud`, unsigned path rejection, dev token production block
  - Operator key single-purpose + 32-byte floor, no public diagnostics
  - Cookie CSRF (no localStorage token store)
  - Logout rate limit + cookie clear
  - Middleware cross-origin mutation block + `crypto.randomUUID`
  - Secure ID helper + earnings executor single key
- npm script: `test:phase3-money-auth`
- Wired into CI static job

### Playwright
- `e2e/phase3-money-auth.spec.ts` — unauthenticated API contracts (approve leakage, logout safety, ledger credit denial, health)
- CI job `playwright`: config validation always; full chromium run when `GHC_E2E_BASE_URL` is set (repo var/secret)
- npm script: `test:e2e:phase3`

### Supply chain
- `scripts/check-phase3-supply-chain.mjs` — **12/12**
  - `pi-backend@0.1.3` official registry pin + lock integrity
  - `@swetate/{auth,core,user-state}` exact `0.1.0` (no ranges)
  - Dependabot present
  - engines Node 24.15 line
  - `legacy-peer-deps` still required (tracked debt in CI + Vercel)
- `scripts/check-phase3-actions-pinning.mjs` — forbids `@main`/`@master`; reports tag-only as WARN (SHA preferred)
- Dependabot (from prior pass): weekly npm + Actions

### npm audit
- CI runs `npm audit --audit-level=critical` without continue-on-error

### Lint ratchet
- `--max-warnings` path: 9999 → 500 → **250** (toward 0)

### CI
- Static job runs Phase 3 money/auth + supply chain + actions pin checks
- `npm audit --audit-level=high` remains informational until baseline is clean
- Node assert: 24.15+

## Remaining Phase 3

1. SHA-pin Actions to full 40-char digests (currently tag-pinned with warnings)
2. Continue lint ratchet toward `--max-warnings 0` (next candidates: 100 → 0)
3. Drop `legacy-peer-deps` when peer tree resolves without force
4. Promote `npm audit` to gating after high findings cleared
5. Expand Playwright with authenticated fixtures when Testnet credentials/fixtures exist
6. Deeper review notes for `@swetate/*` runtime surface (usage audit)

## Notes

- No production deploy implied.
- Playwright job is non-blocking for repos without `GHC_E2E_BASE_URL`.
- Behavioural money/auth tests are source contracts; live A2U transfer success is still operator/Testnet verification.
