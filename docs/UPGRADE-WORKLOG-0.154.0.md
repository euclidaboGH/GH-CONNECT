# GreenHaven v0.154.0 — Phase 1–12 systematic hardening

## Concrete code changes in this release

1. **Phase 8 — GHC spend input integrity:** Removed absolute-value coercion from the domain spend path. Negative, zero, and non-finite inputs now reach positive-amount validation as supplied rather than being normalized into a debit.
2. **Phase 8 — GHC P2P send integrity:** Removed absolute-value coercion from the domain transfer path. A negative amount cannot be converted into a positive transfer by this layer.
3. **Phase 8 — GHC payment-request integrity:** Removed absolute-value coercion from request creation. Invalid sign and non-finite values are rejected by the existing amount validator.
4. **Phase 8 — Request fulfilment integrity:** Request acceptance now validates the chosen amount (`input.amount` or the persisted request amount) before dispatching the transfer, returning an explicit validation error for invalid values.
5. **Phase 8 — Transfer notification consistency:** Notification payloads use the amount already validated by the API instead of applying another absolute-value transformation.
6. **Phase 12 — Regression wiring:** Added `check:phase1-12-systematic-upgrade`, registered it in the static verification suite, and added checks for the financial sign-preservation fixes.
7. **Phase 12 — Release metadata:** Bumped package, lockfile, app release, verified manifest, README and project-truth metadata to `0.154.0` and synchronized the existing release gates.

## Verification

- Full network/DB-independent static suite: run after packaging; see the delivery summary for observed results.
- New systematic upgrade audit: checks release synchronization and the financial-input fixes.
- TypeScript, lint, production build, browser tests, PostgreSQL restore, and Pi Testnet are not considered passed unless run in their supported environments.

## Production boundaries

No production database, migration, wallet, payout, payment, or Pi Mainnet state was changed. This release does not represent all 120 product-level upgrades as complete. Some requested capabilities depend on provider documentation, database/RLS evidence, browser/runtime execution, or operational credentials and must not be simulated with fake implementations.
