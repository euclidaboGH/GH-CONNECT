# GreenHaven 0.124.0 — Pi ecosystem commerce + referral identity

## Policy (Pi Mainnet listing posture)
- **GHC_PI_ONLY_COMMERCE=1** (default) and **NEXT_PUBLIC_GHC_PI_ONLY_COMMERCE=1**
- Fees for marketplace listing and community create settle in **π only**
- GHC remains **earn-only** for users: daily claim, referrals, missions/curation rewards
- Set both to `0` to re-enable dual-rail GHC fee payment after policy review

## Referral attribution
Accepts any of:
- Invite / referral **code**
- **GreenHaven ID** (`GH-XXXXXX`)
- **Pi username** (`@name` or bare)
- **Pi app uid** / linked GH user id when unique

Ambiguous Pi usernames are rejected (no guessing).

## API
- `GET /api/referral/code` also returns `greenHavenId`, `piUsername`, `piOnlyCommerce`
- `POST /api/referral/attribute` resolves multi-key referrer

## Operator env
| Variable | Privacy | Default | Purpose |
|----------|---------|---------|---------|
| GHC_PI_ONLY_COMMERCE | private | 1 | Server fee rails π-only |
| NEXT_PUBLIC_GHC_PI_ONLY_COMMERCE | public | 1 | Client UI π-only fee default |
| GHC_MARKETPLACE_LISTING_FEE_PI | private | 0.05 (testnet) | Listing fee in π |
| GHC_COMMUNITY_CREATE_FEE_PI | private | 0.1 (testnet) | Community create fee in π |
