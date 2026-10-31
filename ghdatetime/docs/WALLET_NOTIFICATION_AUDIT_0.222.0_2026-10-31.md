# GreenHaven 0.222.0 — Wallet + Daily Claim Notification Audit

## Scope
Source audit of the current 0.222.0 project, plus the supplied wallet screen recording. Financial rails, identity, notification projection, wallet navigation, wallet information architecture, static gates, and release boundaries were reviewed. This pass intentionally avoids speculative migration rewrites or changes to payment arithmetic.

## Fixed in this pass
- Daily claim success now creates a durable economy notification from the server-authoritative claim amount. The notification carries `amount`, `asset=GHC`, pending state, redemption time, cycle day, and the canonical claim reference.
- Client notification mirrors no longer create a reward notification for an idempotent replay, a zero amount, NaN, or an unavailable amount.
- Wallet top navigation is sticky and keeps a standard leading Back control visible above wallet content.
- The PI/GHC balance hero has a more premium layered surface, stronger asset hierarchy, softer depth, clearer selected-asset cards, and preserved fail-closed PI states.
- Removed the redundant “PI & GHC in one wallet” explainer beneath the balance hero.
- Removed the duplicate main-screen History promo. Transaction history remains owned by the History action and its dedicated full statement surface.
- Removed duplicate main-screen Full statement / Export / Requests shortcuts. These capabilities remain in their owning flows instead of being repeated on the wallet landing surface.
- Main wallet no longer renders GHC/PI transaction lists beneath the balance card. History is only rendered through the dedicated history surface.
- Added `check-wallet-premium-notification-wiring.mjs` and registered it in `prebuild` and `verify:static` so these regressions fail CI before release.

## Verified existing architecture
- PI and GHC remain separate assets and are never summed.
- PI available/withdrawable/pending/reserved state remains server-authoritative and fail-closed.
- PI payout eligibility and linked identity remain server-derived.
- GHC daily issuance remains server-authoritative and pending for the configured maturity lifecycle.
- Wallet history keeps separate PI and GHC rails and detailed transaction views.
- Existing notification center, marketplace, social, bounded-request, security, treasury, A2U, cashback, and reconciliation static contracts remain intact.

## Wider audit observations
- The project has a large and mature static-contract system; `verify-phase14-static.mjs` passes 57/57 after this change.
- There are still legacy direct `request.json()` call sites across API routes. Existing bounded-request gates cover high-risk paths, but the remaining routes should be migrated incrementally rather than by blind global replacement.
- There are still browser `window.prompt`/`window.confirm` call sites outside the already-hardened marketplace order review flow. These are UX debt and should be replaced with accessible sheets/dialogs by feature owner.
- Dependency warnings/vulnerabilities reported by npm are a separate dependency-modernization track. Do not run `npm audit fix --force` blindly because it can alter financial/provider SDK behavior.
- Production remains subject to the existing operator Testnet, migration-apply, funded receipt, and runtime release gates.

## UX principle
The wallet landing screen is now an overview and action surface, not a duplicate statement screen. Balance and primary actions stay prominent; transaction records belong to History; claims belong to Rewards; membership belongs to Premium; advanced recovery remains secondary. This reduces competing hierarchy and makes the wallet easier to scan on mobile.
