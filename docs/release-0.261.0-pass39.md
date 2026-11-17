> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.261.0 — Pass 39: Independent Domain Hydration

## Scope

Durable social hydration now treats feed, stories, and follow graph requests as independent domains. `Promise.allSettled` allows successful responses to hydrate even when another upstream request rejects or times out. The effect checks its cancellation flag before committing results, preventing late updates after unmount.

## Preserved boundaries

- No payment, wallet, GHC balance, ledger, membership entitlement, or transaction execution logic changed.
- No Supabase migration SQL changed.
- Feed, stories, and follows remain sourced from their existing durable client APIs.
- Existing local/offline behavior and server-authoritative write paths remain intact.
- Canonical navigation remains Home · Messages · Communities · Cart · Profile; Wallet remains an overlay.

## Verification boundary

Static source checks validate independent request settlement, per-domain result handling, cancellation protection, release metadata, and prebuild integration. They do not prove live API availability, deployed RLS, realtime behavior, or payment correctness. Full production build/typecheck requires Node 24.15.x and installed locked dependencies.
