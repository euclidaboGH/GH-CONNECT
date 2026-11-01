> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.265.0 — Pass 43: Domain Session Bridge Activation

**Status:** Source-level upgrade completed; production approval remains withheld.

## Scope

Pass 43 closes an integration gap in the domain-provider architecture. The Feed, Connections and Discovery providers previously exposed getter-binding APIs, but the canonical GHC provider did not bind those getters. They could therefore return empty domain summaries even while the legacy session held data.

The GHC provider now binds all three read seams to a current snapshot derived from `visibleSession` and canonical relationship state. `visibleSession` is produced through the shared block/mute enforcement policy before data crosses the seams.

## Improvements

- Feed read bridge now maps session posts into domain summaries, normalizes numeric/ISO timestamps, and excludes drafts and scheduled posts.
- Connections read bridge reports friend/follow/follower counts and counts incoming pending requests without treating outgoing requests as inbox work.
- Discovery read bridge maps candidate identity/profile fields into the domain contract.
- Production discovery now requires `isSample === false`, the explicit server-hydrated marker. Prefix-only filtering was insufficient because sample candidates can have ordinary-looking IDs.
- The bridge is read-only. Wallet, GHC, Pi payments, membership entitlements and financial write authority are unchanged.
- Added pure runtime-tested session mappers and a dedicated Pass 43 regression gate.

## Verification

- Pass 43 static contract checks: 16/16.
- Pass 43 runtime assertions: 12.
- Earlier release gates are retained and executed by `prebuild`.
- No SQL migration files changed; canonical source inventory remains 170 migrations.
- Full TypeScript and Next.js production build require Node `24.15.0+`; the available runtime in the working environment is Node `22.16.0`, so a supported-runtime production build is not claimed.

## Release boundary

This is a source-level integration improvement, not proof of live backend correctness, applied migrations, Pi provider behavior, or production approval. Preserve the canonical navigation: Home · Messages · Communities · Cart · Profile; Wallet remains an overlay.
