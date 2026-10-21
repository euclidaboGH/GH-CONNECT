# Phase 2 Curation Implementation Status

**Status:** source implementation and static tests exist; live database and Testnet behavior remain unverified in this working copy.

- Curation and reputation use server-owned evidence; client-provided scores, balances, ranks and settlement outcomes are not authoritative.
- Self-curation may be available for display but does not count as independent validation or mint GHC/reputation by itself.
- Settled-curation reputation awards remain gated off until the settlement and compensating-event path can be atomic and audited.
- GHPV calibration settlement must not mutate GHC. GHC rewards and reputation are separate systems.
- Risk signals should trigger throttling or review rather than irreversible punishment from a single weak signal.
- Apply migrations to a disposable PostgreSQL database and Testnet first; run concurrency, replay, self-curation and two-account authorization tests.

No production promotion is approved by this status file. Did not apply any live database migrations as part of this source audit.
