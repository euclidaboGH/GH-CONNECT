> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.262.0 — Pass 40: Canonical Feed Reconciliation

## Scope

This release consolidates duplicated feed merge behavior into `lib/social/reconcile-feed-posts.ts`. The helper provides two explicit modes:

- `replace`: remote records take precedence, while non-deleted local-only records remain available for optimistic/offline continuity.
- `append`: existing records retain precedence and only unseen remote records are added.

Both modes reject blank IDs, remove duplicate IDs, omit locally deleted records, and apply deterministic newest-first ordering with an ID tie-breaker. The helper is presentation-state reconciliation only; it does not persist data or perform financial operations.

The GHC context now delegates repeated feed reconciliation paths to this shared contract, reducing duplicated merge logic across initial hydration, revalidation, post-publish refresh, queued-post refresh, and paginated refresh.

## Release maintenance

Historical Pass 37–39 gates now compare release metadata against the active package version rather than hardcoding `0.261.0`, so they remain useful on subsequent releases. Pass 40 is included at the start of the production prebuild sequence.

## Preserved boundaries

- No Supabase migration SQL changed.
- No payment, wallet, ledger, membership entitlement, or reward execution logic changed.
- Canonical navigation remains Home · Messages · Communities · Cart · Profile.
- Wallet remains an overlay.

## Verification limits

Static regression checks are recorded separately. A supported-runtime production build and TypeScript check require Node 24.15.x and the repository's locked dependencies. Static source checks do not prove deployed Supabase RLS, Pi payment recovery, or live testnet behavior.
