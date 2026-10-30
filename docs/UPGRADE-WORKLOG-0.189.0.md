# Upgrade worklog — v0.189.0

## Phase 6 scope
- Audited the existing Phase 1–5 financial foundations and the existing Phase 11 cross-feature reconciliation path before extending it.
- Added PI ledger-vs-withdrawable snapshot comparison using validated atomic-unit strings/safe integers.
- Removed the hardcoded cashback `featureAvailable: true` probe and replaced it with a server-side authoritative statement RPC read that fails closed on missing/invalid/timeout responses.
- Added explicit healthy/attention/degraded report state and dashboard presentation, including an unavailable state when reconciliation fetch fails.
- Preserved authenticated user scoping, read-only behavior, charity segregation, and PI/GHC asset separation. No financial mutation, migration or provider execution was introduced.

## Verification actually run
Source-level verification only; runtime behavior remains unverified.
- Phase 6 financial reconciliation source contract: 12/12.
- Project truth: 10/10.
- Release hygiene: 11/11.
- Existing Phase 11 cross-feature contract: 9/9.
- ZIP integrity: checked on final archive.
- Full `npm run verify:static`: attempted; failed 53/56 due two stale consolidated acceptance documents and missing current worklog, subsequently corrected. It was not rerun after corrections in this worklog.
- Runtime gate: failed because environment Node.js is v22.16.0; project requires Node.js 24.15.0.
- No `node_modules`, PostgreSQL, Supabase Testnet or authenticated Pi provider test was available; typecheck, lint, Next production build, live DB and Pi lifecycle are not claimed.

## Release status
Source candidate only. No migration was added. Production remains NOT APPROVED pending supported-runtime build, full static rerun, database/Testnet and browser acceptance.
