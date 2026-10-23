# GreenHaven Phase 15 — Social Economy Control Plane

## Purpose

This phase closes the missing connection between Social, Curation, Content Rewards, Reputation and the GHC Wallet.

### Economic rules

- Comments, likes and views **do not mint GHC**.
- Comments create durable attention/conversation evidence and a small non-financial reputation event.
- Curation is a quality signal independent of the wallet balance.
- An upvote may optionally contribute existing GHC from the curator's available wallet balance to the post creator.
- Curation redistribution is a ledger transfer: curator debit + creator credit.
- The content reward display is only a projection of confirmed ledger settlement.
- An empty wallet cannot produce a curation contribution.
- No client value is trusted for identity, amount, balance or reward issuance.

## Fixes

1. Added `gh_social_economy_snapshot(text)` for an authoritative cross-section of wallet, curation funding capacity, claim state and non-minting rules.
2. Added `/api/social/economy/status` to expose that server state to the authenticated UI.
3. Hardened `ghc_curation_redistribute` so a confirmed curator→creator transfer is projected through the canonical content reward settlement function in the same transaction.
4. Added comment attention evidence and `comment_created` reputation events after durable comment creation.
5. Added wallet social-economy state messaging so an empty wallet explains why curation cannot fund a contribution instead of appearing broken.
6. Curation responses now return funding/ledger state and content-reward projection status.
7. Canonical installer regenerated for all 120 clean migrations.

## Verification

- Phase 15 control-plane contract: 14/14
- Phase 14 social/economy integration: 11/11
- Phase 13 profile/social routing: 11/11
- Phase 7 product experience: 27/27
- Database tools: PASS
- Clean migrations: 120/120
- Executable GreenHaven tables: 100

Runtime Vercel/Supabase settlement remains a separate live verification step because this source environment does not contain the deployed project's production credentials or installed dependency tree.
