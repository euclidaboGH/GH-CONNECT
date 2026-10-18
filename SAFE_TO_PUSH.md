# Safe to push (Phase 12)

Static gates passed in packaging environment:

- jsx-safety OK
- production safety scan 21/21

Before promoting Testnet:

1. Extract with `app/` at repository root (no nested folder).
2. `npm ci --legacy-peer-deps`
3. `npm run test:engagement-rosters && npm run typecheck && npm run lint && npm run build`
4. Review `docs/architecture/DEPLOYMENT_FIX_AND_ENGAGEMENT_ROSTER_AUDIT_2026-10-18.md` and apply reviewed migrations to Testnet first.
4. Confirm env vars and migrations on operator side.

Do not commit secrets.
