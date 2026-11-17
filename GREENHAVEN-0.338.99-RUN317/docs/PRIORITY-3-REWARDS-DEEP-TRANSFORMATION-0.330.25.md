# Priority 3 — Rewards deep transformation (0.330.25)

## Product scope

This increment deepens Priority 3 without advancing to Membership. It strengthens the Rewards experience as a connected journey across missions, claim actions, wallet ledger history and achievement transparency.

## Delivered source changes

- Reward ledger history now pages through the authenticated wallet endpoint in bounded 50-transaction windows using a stable server-side keyset cursor ordered by `(created_at DESC, id DESC), with stable ID de-duplication when older pages are appended.
- The wallet history endpoint validates an opaque cursor bound to the authenticated account and returns explicit continuation metadata. Database queries preserve the exact timestamp precision and use the UUID as a deterministic tie-breaker, avoiding offset drift or loss when multiple ledger rows share a timestamp.
- History can continue through the full server ledger in bounded pages. The database-backed wallet balance remains sourced from the complete canonical wallet snapshot and is never computed from a history page.
- Changing account identity clears previously loaded ledger history before the new owner's history is fetched.
- Claim feedback now distinguishes server acceptance from a confirmed available-balance refresh. The UI no longer says the amount was added to available balance merely because the claim endpoint accepted the request.
- Claim-ready summary counts are labelled as local indicators and explicitly require server acceptance before credit is confirmed.
- All seven mission codes supported by the existing server verifier now have explicit Rewards cards and eligibility-check actions. Supported mission cards remain “Ready to verify” until the account-scoped durable achievement list confirms the unlock; only then do they show “Achievement unlocked”. Local progress remains guidance, not proof. Marketplace-sale, community-event and referral missions are locked until their durable evidence verifiers exist, rather than presenting unfinishable actions. Mission cards carry no GHC reward amounts under the current non-financial policy.
- GHC and Pi cashback remain separate reward journeys. No client-side issuance, ledger mutation, payout, transfer or settlement authority was added.

## Known limitations / next backend work

- The keyset cursor is implemented in source using the exact database timestamp plus transaction UUID and is bound to the authenticated user. Deployed Supabase/PostgREST acceptance is still required to verify the nested `or` filter and deterministic ordering against the live schema. The API obtains wallet balances from the complete canonical wallet snapshot, never from a history page.
- Mission evidence, deadlines and per-user progress should be exposed from a canonical server-owned mission snapshot before the UI presents them as authoritative. This increment deliberately does not infer evidence or invent deadlines.
- Mission verification migrations and remote Testnet/Mainnet histories remain subject to separate review. No migration was added or applied here.
- Node 24.15.x dependency-backed typecheck, lint and production build, browser/Android/Pi Browser acceptance and live Testnet acceptance remain required. Production is not approved.

## Financial and security boundaries

GHC and Pi remain separate assets and ledgers. Reward amounts and statuses are not authoritative merely because they appear in local state. The claim endpoint, authenticated owner checks, durable rate limits and server ledger remain authoritative. No wallet balance, reward record, payout request, provider action or financial ledger row was changed by this source increment.
