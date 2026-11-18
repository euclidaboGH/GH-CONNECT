# RUN351 — Audit: shell, onboarding gate, interaction keys, economy helpers
Date: 2026-11-18

## Scope actually available
The uploaded archive holds 17 files. The Welcome/Onboarding, Home feed, Profile screen, profile card
(ProfilePreviewPage), Settings, and Privacy/Security screens are only *referenced* by `app.tsx`
(lazy imports) and are **not in the archive**, so their internals were not audited or edited.
Everything that wires them (boot/welcome states, onboarding gate, profile open flow, settings open/close,
action buttons on posts) was audited and fixed.

## Shell / welcome / onboarding gate (`components/ghc/app.tsx`)
- **Short video never rendered on its own** — it was nested inside the create-hub block, so `ghc:open-short-video` did nothing unless the hub was open, and it vanished when the hub closed. Now independent.
- **Toasts invisible in overlays** — the toast host existed only in the main shell, so anything raised from Settings/Wallet/Marketplace/Ecosystem was silent. Shared `renderToastHost` now used in all five shells.
- **Confirm dialogs in overlays** — `GlobalInteractionDialog` was mounted only in the main shell; now also in the four overlay shells. Settings also gets `DirectCallSheet` like the other overlays.
- **Overlay stacking / lost navigation** — new `closeAllOverlays` (+ `ghc:close-overlays` event). Used by tab navigation, start-chat, open-post, community open, and peer-profile open. Previously, navigating to the already-active tab, or opening a profile preview while Settings/Wallet/Marketplace was open, did nothing visible because the effect only ran when the tab changed.
- `openWallet` now closes Settings and Ecosystem (Back from Wallet no longer lands on a screen the person did not choose).
- **Digit shortcuts (1–6)** were not disabled while Marketplace/Ecosystem overlays were open and could silently switch the tab underneath.
- **Toast timers**: third+ toasts never got a timer and could stay forever; timers restarted on every list change; hidden ids leaked. Now one timer per toast, pruned. Error toasts last 6.5 s (was 3.2 s).
- **Boot spinners** (welcome “Loading your profile…” and “Confirming your GreenHaven identity…”) had no way out if identity hung. Added a reload hint after 12 s. It never forces registration; the identity gate remains authoritative. Identity-unavailable screen now has `role="alert"`, a 44 px target and a focus ring.
- Error boundary: the “Dismiss” button on tab screens was just a second “Try Again”; it now appears only where an overlay can actually be closed (labelled “Close”) and closes before resetting.
- Async `startConversation` rejections (start-chat event, match celebration, profile message) were unhandled; now caught with a toast.
- Attention polling no longer fires while the tab is hidden.
- Nav badge dots: `aria-label` on a bare span was ignored by screen readers (`role="img"` added); dot visibility uses `activeTab` consistently.
- Marketplace `onDismiss` now resets the bucket like `onBack`.
- Removed unused imports (`Heart`, `Plus`, `ShoppingBag`, `Wallet`, `SessionResumeToast`).

## Post card action keys (`enhanced-post-card.tsx`)
- Block author now asks for confirmation (Delete already did).
- Mentions rendered as buttons that did nothing in read-only previews / without a handler → plain text there; real buttons stop propagation so they no longer also open the post.
- Edit dialog: Escape closes; media-only posts can be saved; unchanged saves no longer mark the post “Edited”; the 10-image cap no longer blocks a video; failed uploads show an error toast; remove-image/video targets enlarged.
- “Photo” label used a stricter image filter than the gallery; now shares the gallery's list.
- Toast amount formatting deduplicated; curation “unknown error” detection uses a shared helper instead of a duplicated string; unused import removed.

## Transactions (`ghc-transaction-detail.tsx`)
- Unknown amount showed “₲ 0.00” (invented zero) → “—”. Small amounts were rounded to 2 dp; now up to 8 dp (matches the exported record). Negative values render “−₲ 5.00”, not “₲ -5.00”.
- `correlationReferences` recreated every render, defeating the `receipt` memo → memoized.
- Feedback state resets per transaction; download filename sanitized; Done button focused and has a focus ring.

## Shared helpers
- **membership-domain**: a trial record with no anchor fell back to `now`, restarting a fresh VVIP trial on every read (never expired). Now Free. Default error string shared by constant instead of duplicated literal comparison.
- **wallet**: `isDurableWalletSummary` / `formatAtomicDisplay` treated `null`/`""` as a valid 0 balance.
- **marketplace**: `stockLabel`/`safeListingQuantity` treated missing stock (`null`/`""`) as 0 → “out of stock”, blocking add-to-cart.
- **curation**: generic rate-limit no longer claims a “daily” limit (only `QUOTA` does).

## Verification
- Syntax check of all 15 TS/TSX files: OK.
- Helper behaviour tests (null/blank/edge inputs): passed.
- `check-run350-economy-surfaces.mjs` 14/14; new `check-run351-audit.mjs` 25/25.
- **Not run:** full TypeScript type-check, lint, build, or any runtime/browser test (project dependencies and the missing modules are not in the archive).

## Observed, deliberately not changed
- Membership tier is cached in `localStorage` and trusted by `loadStatus`; fine for UI hints, but any entitlement with real value must stay server-enforced.
- Peer profile hydration falls back to `age: 18` and `lastSeen: 0` when the privacy projection hides them. Needs `Candidate`/`ProfilePreviewPage` to render “hidden” instead; those files are not in the archive.
- `PaymentRecoveryListener` / `NetworkResilience` mount only in the main shell and unmount while Wallet/Marketplace overlays are open. Moving them is an architectural decision.
- Save/“Post saved” toast fires optimistically before the owner reports success.
