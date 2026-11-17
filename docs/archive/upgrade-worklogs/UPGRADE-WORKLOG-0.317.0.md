# Upgrade worklog — 0.317.0

## Phase 6: Profile and Identity performance

Started from the authoritative `0.316.0` Phase 5 archive. Inspected the canonical `ProfileDomain` relationship resolver and existing social-graph dependencies before editing.

### Implemented
- Added a per-domain relationship-index cache derived from canonical social arrays; no second profile or social-graph store was introduced.
- Independently reuses each derived set until its immutable source array is replaced.
- Added deduplicated batch relationship hydration that shares one prepared index snapshot.
- Wired Discovery people lists to prepare the visible people batch once and pass each relationship result into its card/action sheet.
- Preserved the block-first branch before any follow, connect, match or message actions are exposed.
- Kept financial fields and private GHC balances outside the relationship index and public identity shape.
- Updated release metadata, docs and dedicated static/runtime regression gates.

### Verification evidence

This increment has source-only verification evidence; it is not production acceptance.
- Phase 6 relationship index runtime contract: PASS (10 assertions).
- Phase 6 profile performance source contract: PASS (10/10).
- Repository consistency: PASS (6/6).
- Migration source manifest: PASS (186/186).

### Not yet verified
- Supported Node 24.15.x typecheck, ESLint and Next.js production build. The available runtime is Node 22.16.0 and dependencies are not installed; the project requires Node.js 24.15.0.
- Full consolidated static verification is being reconciled against older hard-coded release fixtures.
- Browser/device interaction, production profiling, live Supabase/Pi/Testnet/Mainnet and operator checks.

No database migration, authentication/session, identity authority, wallet, GHC, Pi payment, ledger, payout, checkout or settlement behavior was changed.

**Release status:** source increment only; not approved for production deployment.
