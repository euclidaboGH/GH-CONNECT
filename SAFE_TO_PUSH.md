# Safe to push (Phase 12)

Static gates passed in packaging environment:

- jsx-safety OK
- production safety scan 21/21

Before promoting Testnet:

1. Extract with `app/` at repository root (no nested folder).
2. `npm ci --legacy-peer-deps`
3. `npm run typecheck && npm run build`
4. Confirm env vars and migrations on operator side.

Do not commit secrets.
