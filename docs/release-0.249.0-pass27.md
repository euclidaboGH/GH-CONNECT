> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.249.0 — Pass 27: Unified Cross-Feature Experience

## Objective

Pass 27 makes Home operate as a continuity layer across GreenHaven instead of presenting isolated feature suggestions. The Home surface now considers authoritative/read-only state from conversations, communities, identity, discovery, creation, the Daily Claim system and the wallet read model, then presents one primary next step with a small set of relevant alternatives.

## Product outcome

The member should be able to understand what is useful now and move directly to the relevant GreenHaven surface without having to remember where a task or opportunity lives. The experience remains transparent: each recommendation explains why it is present, and the model does not invent activity, balances, opportunities, users or guaranteed outcomes.

## Cross-feature continuity

The new `lib/home-cross-feature.ts` model supports Messages, Communities, Discovery, Profile, Creation, Wallet and Rewards. Wallet signals are limited to the existing display-only wallet read provider and are shown only when the provider has a server-confirmed ready snapshot. Daily Claim is driven by the shared server-authoritative claim status hook.

## UX changes

- Replaced the previous Home personalization surface with `HomeCrossFeaturePath`.
- One primary next step is visually dominant.
- Up to three secondary relevant steps are horizontally accessible without creating a competing dashboard.
- Every primary step includes a concise reason for its presence.
- Existing Home journey, results, activation and community surfaces remain intact.
- Canonical navigation remains Home · Messages · Communities · Cart · Profile.

## Safety and architecture

- No Supabase migration files were changed.
- Financial actions remain outside the Home read model; Home only opens existing wallet/rewards surfaces.
- No client-side wallet mutation or reward mutation was introduced.
- No fabricated metrics or synthetic activity were introduced.
- Existing navigation helpers remain the routing boundary.

## Verification

- Pass 27 cross-feature experience gate: 10/10.
- Release hygiene: 11/11.
- Regional context: 10/10.
- Full production build/typecheck is not claimed in the Node 22 execution environment; the project requires Node 24.15.0.
