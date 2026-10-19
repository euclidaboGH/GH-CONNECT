# Phase 23 — Screen-by-screen premium UI review

**Release:** GH-CONNECT 0.62.3  
**Review style:** feature-root source review and responsive/accessibility refinements. This is not a screenshot-based or device-lab certification because dependencies and a runnable browser environment are not available in this workspace.

## Screen matrix and acceptance criteria

| Screen / component | Phone (320–639 px) | Tablet (640–1023 px) | Desktop (1024+ px) | Pi Browser-specific checks |
|---|---|---|---|---|
| Onboarding — `components/ghc/onboarding.tsx` | Safe-area-aware scroll, reachable controls, no clipped final CTA, inputs at least 44px tall | Keep focused form width and step progress visible | Calm centered form; no excessively wide text lines | Pi sign-in is server-verified; no seed phrase entry; browser back does not discard form silently |
| Feed — `components/ghc/enhanced-feed-screen.tsx` | Stable vertical scroll, media does not cause horizontal overflow, actions remain reachable | Feed column stays readable | Centered 47–52rem content width; avoid stretched cards | SDK absence must not block reading feed; payment prompts never imply client-only settlement |
| Discover — `components/ghc/discovery-grid-screen.tsx` | Search and category tabs horizontally scroll without page overflow | Wider results gutters and cards | Results retain readable line lengths and balanced gutters | External profiles/links open safely; no unsupported Pi Browser user-agent assumptions |
| Profile — `components/ghc/profile-screen.tsx` | Cover and identity can reflow; long GH IDs/handles wrap | Profile content remains aligned | Content centered with sensible max width | Identity and wallet details remain server-authoritative; no seed phrase collection |
| Messages — `components/ghc/message-screen.tsx` | Keyboard/safe-area composer, contained log scrolling, no obscured send button | Inbox and conversation spacing remain distinct | Conversation log max-width 60rem | Interrupted/failed network sends remain clearly pending; no false sent state |
| Communities — `components/ghc/communities-screen.tsx` | Join/create actions and tabs fit; lists scroll inside app viewport | Content max width and gutters | Community directory avoids edge-to-edge stretched cards | Community membership never grants financial authority or reward by client state alone |
| Marketplace — `components/ghc/marketplace-screen.tsx` | Listing form fields fit; purchase actions remain visible; no accidental double submit | Listing cards and details use available width | Catalog and detail panels use bounded content width | U2A uses official Pi SDK handshake; no fulfilment until server completion; network matches registered app |
| Wallet — `features/wallet/wallet-screen.tsx` | Balances and transaction rows wrap; safe-area padding; clear PI/GHC distinction | Activity readable without over-wide rows | Balance and activity sections remain bounded | Never request seed phrases; PI and GHC are separate assets; no implied automatic conversion |
| Settings — `components/ghc/settings.tsx` | Search/sections usable at 320px; buttons reachable | Search and section lists centered | Max-width settings reading column | About/version matches build; support/legal links use registered trusted domains |
| Global shell/navigation — `components/ghc/app.tsx` | Bottom nav clears system safe area; labels and active tab are accessible | Navigation doesn't become excessively stretched | Main content uses balanced multi-column composition only where intended | Pi SDK availability failure is recoverable; do not infer network solely from user-agent |
| Dialogs/action sheets — shared components | Scrollable body and visible close/cancel controls; avoid keyboard occlusion | Dialog size bounded | Modal width and focus handling consistent | Cancel does not mutate durable payment state to success; payment recovery remains explicit |

## Phase 23 code-level refinements

- Added named screen landmarks for Discover, Profile, Messages inbox/thread, Communities, Marketplace, Wallet, Settings and onboarding.
- Added per-screen width, input-height, scroll containment, overflow and spacing refinements for Feed, Discover, Profile, Messages, Communities, Marketplace, Wallet, Settings and onboarding.
- Added forced-colors focus/border support for high-contrast users.
- Kept existing feature logic and the financial authority model intact.
- Replaced stale `0.59.4` version labels in Settings with the shared `APP_RELEASE_VERSION` value.
- Added `scripts/test-phase23-pi-screen-review.mjs` to cover screen roots and Pi integration invariants.

## Manual device review still required

On a real Android phone (including the target Pi Browser), a tablet viewport, and desktop Chromium, record screenshots for each screen at widths 320, 360, 390, 768, 1024, and 1440 pixels. Check landscape orientation, browser back, keyboard-open state, reduced motion, forced colors, slow network, offline/reconnect, empty/loading/error states, large text, long names/IDs, and media failures. Run Playwright/E2E after the clean dependency install. Source assertions cannot prove pixel-level appearance, touch feel, Pi SDK runtime behavior, or app submission compliance.
