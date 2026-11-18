> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.239.0 — Massive Upgrade Pass 17

## Relationship Intelligence & Messaging Outcomes

Pass 17 makes Messages more results-oriented without inventing relationship scores or weakening privacy. The inbox now converts existing request, unread, community-chat, connection and match state into one clear next action.

### Product improvements
- Added a compact Relationship Action Centre to Messages.
- Prioritizes message requests, then unread conversations, then community conversations, then responsible discovery.
- Replaced placeholder empty connection/match arrays with actual existing GreenHaven context state.
- Corrected offline messaging copy so the UI no longer promises that unsent messages are automatically queued when that guarantee is not established by this surface.
- Preserved Requests as the safety boundary for people outside the accepted network.
- Preserved All, DMs, Unread, Requests and Communities inbox filters.
- Preserved canonical bottom navigation: Home · Messages · Communities · Cart · Profile.
- Wallet remains an overlay.
- No database migration was introduced for this pass.

### Engineering boundary
This pass is presentation/orchestration only. It does not alter payment, wallet, membership, rewards, marketplace authorization, Pi payment or database security boundaries.
