> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Step 4 — bounded context migration notes

GreenHaven retains the existing App Router and domain contexts while separating feed, messaging, notifications, discovery, connections and wallet-read concerns under `contexts/domains/`. The shared application context remains a compatibility boundary during incremental migration.

Rules for future work:

1. Do not create a second identity, membership or GHC ledger authority.
2. Migrate one domain at a time; preserve public contracts until callers are migrated.
3. Keep privileged credentials and durable writes server-side.
4. Add tests and update the authority map when a boundary changes.
5. Treat this source-level architecture note as guidance, not proof that every runtime path is already fully isolated.
