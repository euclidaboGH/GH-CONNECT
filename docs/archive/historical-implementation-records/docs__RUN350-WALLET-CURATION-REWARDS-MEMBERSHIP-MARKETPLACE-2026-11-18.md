# RUN350 — Wallet, curation, rewards, membership, transactions, marketplace
Date: 2026-11-18

## Careful scope
Worked section-by-section on client guards, labels, navigation surface separation, and shared helpers. Server ledger/payment **authority unchanged**. No Mainnet enablement. No invented balances or rewards.

## Curation
- **Bug:** `isSelfCuration` / `humanizeCurationError` imported in `enhanced-post-card` but own-post votes still hit the API.
- **Fix:** Block when `isOwn` or `isSelfCuration(viewer, author)`; toast with `SELF_CURATION` message.
- Debounce uses `CURATION_UI_DEBOUNCE_MS` (400ms).
- Error path prefers humanized codes (`AUTH_REQUIRED`, `RATE_LIMITED`, durable-write, etc.).

## Transactions
- GHC transaction detail **kind labels** aligned with wallet `TX_LABELS` (e.g. earned → “Activity credit”).

## Wallet / rewards / membership navigation
- Opening Settings (rewards, membership, wallet sections) now **closes Marketplace and Wallet overlays** so surfaces do not stack incorrectly.
- Wallet focus deep-links for `ghc` / `pi-payments` retained from RUN349.

## Shared helpers (`lib/active-upgrades/*`)
- **wallet:** durable summary guard, dual-rail attention count.
- **rewards:** claim CTA gate, claim error humanizer (no amount invention).
- **membership:** tier/active/days-remaining + humanize errors; **membership-domain** uses shared humanizer.
- **orders:** status labels, terminal/buyer/seller action hints.
- **marketplace:** cart gate + bucket labels.

## Cart vs wallet
- Existing separation policy in `lib/commerce/cart-wallet-separation.ts` retained and checked.

## Marketplace / orders
- Orders bucket deep-link retained; helpers document status presentation only.

## Regression
`scripts/check-run350-economy-surfaces.mjs` — **14/14 PASS**

## Not claimed
Live Pi auth, dependency audit, or schema migration application.
