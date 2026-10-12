# Section A + B implementation (2026-10-12)

Safe implementation of release/environment and identity/session hardening.

## A — Release & environment

| Item | Implementation |
|------|----------------|
| A1 Operator CI | Documented; `ci:verify` + `ops:ab-gates`; full `npm ci`/build remains operator/CI |
| A2 GitHub Actions | `.github/workflows/ci.yml` — typecheck, lint, jsx, safety, verify:static, migrations, identity conflict, build |
| A3–A4 Migrations | `docs/MIGRATION_ENV_INVENTORY.md` + existing checklist/manifest (no live DB writes) |
| A5 Fail-closed secrets | Existing `lib/server/readiness.ts` + `/api/health` 503 in production |
| A6 Env matrix | `docs/ENV_MATRIX_PREVIEW_PRODUCTION.md` |
| A7 Rollback | `docs/ROLLBACK_RUNBOOK.md` extended |

## B — Identity, sessions, auth

| Item | Implementation |
|------|----------------|
| B8 Durable identity/sessions | Readiness `identity_durable` / `session_durable`; auth/pi fail-closed |
| B9 Identity conflict test | `scripts/test-identity-conflict-static.mjs` |
| B10 WebAuthn / session | Static path checks in `test-identity-authz-static.mjs`; Pi Browser E2E still operator |
| B11 Step-up | Already on transfers/spend/accept/revoke-others; **added** withdrawals POST + membership activate POST |
| B12 IdentityService audit | Static gate + header clarification: server issues `ghUserId`; client never trusted on writes |

## Commands

```bash
npm run test:identity-conflict
npm run test:identity-authz
npm run ops:ab-gates
npm run ops:ab-gates -- --strict
npm run ci:verify   # full local CI sequence when node_modules present
```

## Not claimed

- Live Testnet two-user conflict E2E  
- Pi Browser WebAuthn unlock on device  
- Production deployment approval  
