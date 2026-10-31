# Phases 1–6 (A–F) hardening pass (0.177.0)

## Improvements

### Phase A — Daily claim
- Success flash on claimed pill (“Claimed — pending 48h”) for 4s after server claim

### Phase B — Marketplace orders
- Human-readable status labels (Awaiting payment, Fulfilling, Completed, …)
- **Next action** hints for buyer/seller on each order card

### Phase C — Trust / reviews
- **Inline review form** (rating 1–5 + text) replaces `window.prompt`
- Domain still enforces completed-order + buyer-only

### Phase D — Communities
- Mod console **Decline** calls `onDeclineRequest` (wired from communities screen) with `onRejectRequest` fallback

### Phase E–F
- Prior toast/tab/gate work retained; regression children still run

## Gate
`node scripts/check-phase-1-6-hardening.mjs`
