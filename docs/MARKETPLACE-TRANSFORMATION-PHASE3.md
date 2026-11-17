# Marketplace transformation — Phase 3: Saved delivery addresses (source candidate)

Base: `0.338.86` + Phases 1–2. Scope: source-only and additive. **The database change is a held proposal, not a migration, and has not been applied anywhere.** No financial, order, payment, payout or provider code changes. No version bump.

## Delivered
1. `supabase/proposals/20261116_marketplace_phase3_saved_addresses_proposal.sql` — owner-only table `gh_marketplace_saved_addresses` (RLS enabled, deny-all client policy, grants revoked) and five service-role-only `SECURITY DEFINER` RPCs with pinned `search_path`: list, save, set-default, delete, erase-user. One default per user (partial unique index), a cap of 10 active addresses, per-user advisory lock so the cap and default rule cannot race, hard delete (no retained personal data) that promotes a remaining address to default, and an erase-user RPC for account-deletion/erasure requests (operator hook; the lifecycle route does not delete automatically).
2. `lib/marketplace/saved-addresses.ts` — pure client contract: defensive row parsing, bounded lists, default selection, one-line summary (never includes the phone), phone masking, and save-payload building on top of the Phase 2 `address-validation.ts`.
3. `app/api/marketplace/addresses/route.ts` — authenticated GET / POST (save, `action: "set_default"`) / DELETE. Rate-limited fail-closed, 8 KB body bound, user id taken only from the session, `Cache-Control: no-store`, no logging of address data. Until the proposal is applied the route returns 503 `MARKETPLACE_ADDRESSES_UNAVAILABLE`; it never falls back to browser storage.

4. `components/ghc/marketplace-addresses.tsx` — a collapsed-by-default "Delivery addresses" panel in the Orders section: list, add, edit, make default, remove. It loads only when opened, validates with the shared helper, shows phone numbers masked, never stores anything in the browser, and says plainly when the server table is unavailable. It does not touch any order, payment or checkout call.

## Verification
- `scripts/check-phase3-marketplace-saved-addresses.mjs` (static gate) and `scripts/test-phase3-marketplace-saved-addresses.mjs` (unit tests); `npm run check:marketplace-phase3`.

## Deliberately not done
- **Addresses are not attached to orders.** Orders carry no delivery address today. Attaching one means changing the order-creation contract (`POST /api/marketplace/orders` accepts only listing, variant and quantity; the row-locking `gh_marketplace_order_create_reserved` RPC owns price and inventory) and adding a column or snapshot table, i.e. a migration. That is a financial-path change and needs its own reviewed design; it is intentionally not part of this additive step.
- **SQL not rehearsed.** It has not been run on PostgreSQL. It must be rehearsed on a disposable database, then reviewed against reconciled Testnet/Mainnet migration history, before anyone promotes it into `supabase/migrations`. Do not run `supabase db push`.

## Not claimed
Node 24.15.0 typecheck/lint/build, browser/device acceptance, live data, PostgreSQL concurrency of the RPCs. Production remains NOT APPROVED.


## Hardening Phase 1 (2026-11-16)
See `docs/HARDENING-PROGRAM-4-PHASES.md`. Soft delete replaced by hard delete; erase-user RPC added; route reads fields strictly and never reflects raw RPC errors; RLS and SECURITY DEFINER gates now scan `supabase/proposals`. Still a held proposal: not applied, not rehearsed on PostgreSQL. Production remains NOT APPROVED.
