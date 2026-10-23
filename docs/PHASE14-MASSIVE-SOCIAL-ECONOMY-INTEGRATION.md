# GreenHaven Phase 14 — Massive Social Economy Integration

## Objective

Connect the social layer, curation, content rewards, creator rewards, tips, and GHC wallet without allowing client-side reward creation.

## What changed

### 1. Curation → wallet → content
- Curation remains a quality signal and does not mint GHC.
- Optional balance-funded curation can transfer existing GHC from the curator to the post creator.
- The transfer is validated against the real post owner and active upvote.
- The ledger transfer is the economic source of truth.
- The content reward projection records the same confirmed movement so the post can display the funded amount.

### 2. Tip → content reward projection
- A settled GHC tip attached to a post now updates that post's durable reward projection.
- The tip transfer still uses the atomic dual-entry GHC ledger path.
- A retry cannot double-count the content reward projection.

### 3. Creator reward pool → content
- An approved funded creator reward settles from the dedicated reward-pool ledger account.
- Once the transfer is verified, the same settlement is projected onto the content reward view.
- No client can create the reward and no reward is settled without funded ledger value.

### 4. Live UI synchronization
- Post reward panels refresh when a confirmed content-reward update occurs.
- Wallet refresh events continue to hydrate the authoritative server ledger.
- Curation success can therefore update both the post reward surface and wallet without a manual navigation cycle.

## Safety model

The system intentionally distinguishes:

- **Quality signals:** views, comments, reactions, curation, reputation and GHPV.
- **Funded GHC movement:** tips, wallet-funded curation and approved creator rewards.
- **GHC issuance:** still governed separately by the server issuance policy; social actions do not mint GHC.

An empty wallet therefore correctly produces no wallet-funded curation contribution. It must never fabricate a reward merely because a user upvoted or commented.

## Verification

Static contracts passed:

- Phase 14.2 social/economy integration: 11/11
- Phase 14 social/economy wallet bridge: 22/22
- Phase 13 profile/social routing: 11/11
- Phase 7 product experience: 27/27
- Clean migrations: 120/120
- Executable GreenHaven tables: 100
- Phase 5 database tooling: PASS
- Phase 15 account/payout/quality source checks: 25/25

Runtime/browser and live Supabase settlement execution are not claimed here because this environment does not have the project's production credentials or installed dependency tree.
