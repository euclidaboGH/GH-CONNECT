# High-risk 20 upgrades — 0.338.17

## CI failure fixed
- `check-phase2-visual-cohesion.mjs` required marketplace class `flex shrink-0 flex-col gap-1.5 border-b` — restored on marketplace header chrome.

## 20 high-risk problems addressed (source)

1. Production approval drift — `PRODUCTION_RELEASE_APPROVED = false`
2. Missing credentials on authed client fetches — constant + payment timeline fixed
3. Unbounded financial history reads — 12s timeout on payment timeline
4. Unbounded social list reads — 15s short-video timeout
5. Session concurrency contract — SESSION_MAX_ACTIVE_DEFAULT = 8
6. Commission env override risk — fixed 500 bps constant
7. Quote mistaken for reservation — PI_QUOTE_RESERVES_FUNDS = false (+ prior policy)
8. Remote push premature enable — REMOTE_PUSH_PRODUCTION_ENABLED = false
9. Demo actor graph pollution — isDemoActorId helper
10. Settings export secret leakage — forbidden key denylist
11. Message idempotency overflow — max 80
12. Oversized message bodies — max 8000
13. Cart DoS via line spam — CART_LINE_MAX 50
14. Discovery radius abuse — clamp 1–100 km
15. Negative/NaN amount display — safeDisplayAmount
16. Float Pi drift — atomic floor helper
17. Cart/wallet CTA confusion — surface constants (+ separation module)
18. CSP enforcement required flag
19. Withdrawal without PIN — WITHDRAWAL_PIN_REQUIRED
20. Production identity mapping fail-closed flag

## Product wiring this release
- Marketplace visual cohesion class restored
- Pi payment timeline: credentials + timeout
- Notification economy mark-read: AbortSignal.timeout(10s)
- Short-video load: timeout 15s
- QR SVG documented as locally generated only
- Prior 0.338.16 sticky max / consent timeout retained

## Gate
`node scripts/check-high-risk-20-upgrades-0.338.17.mjs`

Production remains **NOT APPROVED**. No migrations applied. No live payouts executed.
