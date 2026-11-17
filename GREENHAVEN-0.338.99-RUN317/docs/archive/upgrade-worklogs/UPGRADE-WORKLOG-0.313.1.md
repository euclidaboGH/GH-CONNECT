# UPGRADE WORKLOG — 0.313.1 Final polish

**Date:** 2026-11-04

- Toast bottom inset increased so messages sit above the bottom navigation.
- Toast host max-width tightened for mobile.
- Attention badges hidden on the *active* tab (Home/Messages/Communities/Profile) so red dots are not sticky while viewing that surface; still shown when another tab has unread.
- Version/docs/manifest synchronized to 0.313.1.
- No financial authority, migration, or A2U changes.


## Pi payout authorization hardening (2026-11-04)

- Added safe HTTP/RPC diagnostics for the explicit Pi wallet-consent flow without logging credentials or raw upstream SQL messages.
- The wallet UI now requires a fresh server read to confirm active authorization and matching Pi UID before it treats consent as active.
- The durable payout-request API now independently enforces active wallet authorization before reserving a request; the execution worker retains its separate authorization check.
- Mainnet and payout execution flags were not enabled. No database migration was applied and no live Pi transfer was attempted.
- Static verification was run. The first pass exposed pre-existing release-document and client-directive drift; those source issues were corrected. Full install/typecheck/lint/build remain unverified because this audit container has Node.js 22.16.0 while the project requires Node.js 24.15.0, and the locked dependency install did not complete before timeout.

The static suite is source-only verification; it is not a substitute for a Node.js 24.15.0 typecheck, lint, production build, or live database/Testnet acceptance.
