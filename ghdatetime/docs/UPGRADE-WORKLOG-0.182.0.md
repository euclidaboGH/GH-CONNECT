# Upgrade worklog — 0.182.0

Phase 4 PI withdrawal boundary hardening based on the 0.181.1 Phase 3 candidate.

- Bounded quote request JSON to 8 KiB and standardized 400/413 errors.
- Validated PI decimal and atomic amount inputs, including safe-integer conversion.
- Added 10-second quote timeout, abort-on-supersede, stale-response protection, no-store semantics, and unmount cleanup.
- Added regression contract and wired it into prebuild/static verification.
- No database migration, payment execution, live balance mutation, or deployment performed.
- Actual general earnings payout lifecycle remains a release gate; Mainnet stays disabled.

Verification was source-only in the available environment. Node.js 24.15.0 is required for supported-runtime typecheck, lint, and production build; the local Node.js 22.16.0 runtime is insufficient.
