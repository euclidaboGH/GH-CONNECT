# Step 4 — bounded context migration notes

GreenHaven retains the existing App Router and domain contexts while separating feed, messaging, notifications, discovery, connections and wallet-read concerns under `contexts/domains/`. The shared application context remains a compatibility boundary during incremental migration.

Rules for future work:

1. Do not create a second identity, membership or GHC ledger authority.
2. Migrate one domain at a time; preserve public contracts until callers are migrated.
3. Keep privileged credentials and durable writes server-side.
4. Add tests and update the authority map when a boundary changes.
5. Treat this source-level architecture note as guidance, not proof that every runtime path is already fully isolated.
