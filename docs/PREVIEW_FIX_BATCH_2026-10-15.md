# Preview fix batch — 2026-10-15

## User-reported (fixed)
1. **Edit Post media** — dialog now supports remove/add photos, remove/replace video, attachments; durable upload pipeline; API + socialEditPost + context accept media.
2. **Header density** — tighter padding/title on collapsing header.
3. **Bottom nav overlay** — box-shadow/::before/::after disabled; lighter chrome.
4. **Daily claim stays green** — after successful (or already-claimed) server response, `claimDailyStreak` mirrors local day key so UI shows Done / “Today claimed”.
5. **COMMUNITY QUALITY / Votes rank** educational footers removed from post cards + compact Quality line on reward panel.
6. **Wallet** — collapsed triple compliance banners into one line (balances still server-authoritative; no fake 245.80).
7. **Messages** — shortened educational footer copy.
8. **Profile** — softer completion prompt wording.

## Also
- Edit API patches optional images/video/pdf when provided (safe URL checks; no blob).

## Honest scope note
“30 problems per section” is not a single-turn scope. This batch targets the concrete preview failures. Empty Discover/Marketplace reflects real empty data (nothing fabricated).

## Not changed
Ledger authority, balance invention, Pi branding, RLS.
