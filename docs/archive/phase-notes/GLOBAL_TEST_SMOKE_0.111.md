# GreenHaven 0.111 — Global test smoke checklist

Run on Pi Browser Testnet after deploy.

## Daily claim + wallet
1. Golden GHC coin FAB with lightning appears when claimable.
2. Confirm sheet → Claim → FAB hides; Rewards Available matches Wallet available.
3. Pending hold → Claim/Redeem → available rises within ~1s without logout.

## Membership
1. Purchase with Pi (sandbox) or GHC.
2. If stuck on Free after paid Pi: Recover purchase restores tier without double charge.
3. VIP badge appears on own profile after activate/recover.

## Marketplace
1. Publish listing with GHC fee — wallet deducts; listing appears.
2. Publish with Pi fee — must complete GH Pay; unpaid Pi does not pretend GHC settled.
3. Buy with GHC — order confirmed; Orders Pay now settles open GHC orders.
4. Edit listing charges half fee; non-refundable copy visible.

## Community
1. Create community with GHC or Pi fee — durable cover; My communities lists it.
2. Join public / request private — correct toast (Joined vs Request sent).
3. Owner approve request → member can open Board/Chat.

## Feed + profile
1. Vote/comment/save durable (no RPC 404).
2. Profile photo/cover durable display after upload.
3. Offline banners honest; no invented success.

## Do not enable on global test without policy review
- GHC_WITHDRAWALS_ENABLED
- PI_A2U_ENABLED
- PAYSTACK_TRANSFERS_ENABLED
- GHC_TIPS_ENABLED

## 0.112.0 additions

### Discover
- Deck excludes self, friends, following, blocked, mutual matches, and pending connection requests.

### Messaging
- Screen-level send dedupe (1.5s) in addition to MessageInput lock — reduces double-delivery from Enter+tap races.

### Feed
- Soft revalidate on app focus / visibility (throttled) for multi-user freshness.

### Economy
- `lib/economy-client-events.ts` for consistent wallet refresh broadcasts.
