> **LEGACY VERIFICATION FIXTURE — NOT CURRENT PRODUCT AUTHORITY.**
> This document is retained only because an executable regression/operator check references it. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md` and executable source. Do not resurrect historical behavior from this file.

# Phase 4 — Cross-feature identity integration

Release: `0.93.0`

## Scope

- Apply the shared canonical public-profile hydrator to the authenticated main feed and search results (people, posts, videos, creators).
- Hydrate nested comment previews returned in the main feed so feed cards and the dedicated comments endpoint can converge on the same canonical public name/photo source.
- Keep identity enrichment best-effort and batched; the UI remains usable if profile lookup is temporarily unavailable.

## Security and product invariants

- Only `gh_user_id`, `display_name`, `username`, and `photos` are read by the shared helper.
- No identity hydration changes authorship, post visibility, ranking, follow/block decisions, balances, rewards, memberships, or transactions.
- Service-role credentials remain server-only; requests are no-store.
- No database migration is introduced by this phase.

## Validation

Run:

```sh
npm run check:phase4-identity-integration
npm run check:phase3-profile-identity
npm run check:phase2-identity
npm run check:release-hygiene
npm run check:dependency-lock-integrity
npm run test:safety
```

Then deploy to Testnet and check multiple accounts across feed, comment previews, people search, post search, video search, creator search, profile timelines, and stories. Verify names/photos match their canonical profile records and that private/economy data is not returned. A passing source check is not proof of a live database or deployment result.
