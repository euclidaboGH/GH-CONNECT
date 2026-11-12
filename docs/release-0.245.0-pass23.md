> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PRODUCT AUTHORITY.**
> Consult `docs/SOURCE_OF_TRUTH.md` and `docs/PROJECT_TRUTH.md` for current authority. Preserve this file for historical traceability only.

# GreenHaven 0.245.0 — Pass 23 Unified Attention & Activity Intelligence

Pass 23 introduces a unified attention layer for the notification experience. It prioritizes real unread activity across messages, requests, marketplace, wallet, communities, rewards, and account notices, then provides one concrete next action. The implementation is derived from existing notification state and does not fabricate activity, rankings, balances, rewards, or outcomes.

The change preserves the canonical navigation: Home, Messages, Communities, Cart, Profile. Wallet remains an overlay. No Supabase migrations were modified; the existing 170 SQL migration files remain intact. Financial, payment, membership, rewards, privacy, blocking, moderation, and server-authoritative authorization boundaries are unchanged.

Verification: Pass 23 gate 8/8. Release hygiene is expected to pass after this release notice is added. Full production build/typecheck remains unclaimed until the required Node 24.15+ runtime is available.
