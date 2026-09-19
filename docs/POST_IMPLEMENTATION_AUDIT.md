# GH-CONNECT Post-Implementation Ops Hardening

## Added in ops-hardening pass
- Readiness checks: `messaging_durable`, `profile_store_config`
- Feature flag: `NEXT_PUBLIC_MESSAGING_DURABLE`
- Messaging domain optional durable send (idempotent clientMessageId)
- Docs: MIGRATION_CHECKLIST, IDOR_TEST_CHECKLIST, ROLLBACK_RUNBOOK, PRODUCTION_OPS
- CI: `.github/workflows/ci.yml` (typecheck, lint, safety, build)
- Scripts: `ci:verify`, `test:idor-checklist`, `ops:migration-check`
- `.nvmrc` → Node 24

## Still required on your side
- Apply migrations on Supabase (Staging → Production)
- Set Vercel env (service role server-only)
- Run `npm run ci:verify` or rely on GitHub Actions
- Manual two-account IDOR on Staging
- Enable `NEXT_PUBLIC_MESSAGING_DURABLE=1` only after messaging migration + IDOR pass
