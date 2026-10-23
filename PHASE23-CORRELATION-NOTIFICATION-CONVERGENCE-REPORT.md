# GreenHaven Phase 23 — Correlation + Notification Convergence

## Scope
Introduces a canonical versioned correlation envelope so Wallet, Activity Center, Notifications, Creator/Profile and Marketplace can resolve the same durable economic/social event without changing ledger authority.

## Implemented
- `lib/server/economy/correlation.ts`: canonical v1 correlation builder and best-effort service-role ledger enrichment.
- New forward migration `20261023010001_ghc_transaction_correlation_envelope.sql` with service-role-only metadata enrichment RPC. It cannot alter amount, status, source event or reference identity.
- GHC transfers enrich both sender and recipient ledger rows with counterparty/request correlation.
- GHC creator tips enrich both tipper and creator ledger rows with post/tip/counterparty correlation.
- Marketplace GHC payment paths enrich ledger rows with durable order/listing correlation.
- Social notifications now carry the same correlation envelope.
- Economy transfer notifications now carry the same correlation envelope.
- Notification deep-link resolver understands nested correlation metadata.
- Wallet/Activity attribution understands nested correlation metadata and gives creator tips explicit labels.
- Canonical Supabase installer regenerated; baseline now covers 121 clean migrations / 100 executable GreenHaven tables.

## Safety properties
- Correlation is read-only navigational/audit metadata.
- Financial amount/status/source/reference fields are not modified by enrichment.
- Enrichment failure never turns a successful financial mutation into a failure.
- RPC is service-role only.
- Existing legacy reference heuristics remain as compatibility fallback.

## Verification
- Phase 23 correlation contract: 13/13 PASS
- Phase 22 unified activity: 17/17 PASS
- Phase 21 attribution: 12/12 PASS
- Phase 18 community/notification: 13/13 PASS
- Phase 16 cross-surface: 13/13 PASS
- Database source contract: PASS — 100 executable tables / 121 migrations
- Phase 5 database tooling: PASS — canonical installer covers all 121 migrations

No production Next.js build/typecheck is claimed from this workspace.
