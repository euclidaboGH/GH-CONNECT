# Priority 11 — Notifications transformation (0.330.41)

## Product objective

Notifications are redesigned as an attention and action surface rather than an undifferentiated activity list. The experience must help a user distinguish urgent security/transaction failures, items that may need a response, and ordinary social updates while preserving the canonical recipient-scoped server inbox.

## Source changes

- Added `lib/notification-priority.ts`, an explainable deterministic classification and ranking model with critical, high, normal and low bands. It does not infer financial outcomes or treat arbitrary client metadata as authoritative.
- The Notification Center's Priority view now shows unread critical/high items and sorts them by score, then recency. Expanded notification detail explains why an item is prioritized.
- Local notification records and dismissed-ID markers now use identity-scoped storage keys. Legacy unscoped cache is migrated only for the local Studio placeholder identity and is never attributed to a newly authenticated account.
- Notification category preferences now use account-scoped keys. Settings category toggles are wired to both in-app and push channel preferences, and direct browser alerts enforce the same account-scoped push setting for matches, messages, rewards, membership, profile views and optional product updates.
- System/security notices remain enabled in-app by default; optional profile-view and product-update categories default off.
- Domain and direct notification producers enforce account-scoped in-app and push channel preferences independently. The legacy smart-notification push queue also consults the current account's category preference and guards browser-only APIs.
- Mark-read failures are surfaced and optimistic state is reconciled. The bulk-read success toast is emitted only after all participating durable stores report successful HTTP responses.
- The notification dialog now moves focus into the dialog, traps Tab/Shift+Tab while open, and restores focus when closed. Existing Escape, tab navigation, deep links, category buckets, grouped channel history and recipient-authorized server APIs remain intact.
- The local hide action is labelled honestly as device-local; it does not claim to delete the server's durable notification record.

## Authority and safety boundaries

- `gh_notification_inbox` remains the canonical durable inbox projection; the server resolves recipient identity from the authenticated session, and notification RPC execute privileges remain service-role-only.
- This increment adds no migration and does not change wallet, GHC, Pi, payout, membership entitlement, marketplace payment or settlement authority.
- Browser notification permission remains user-initiated. Push delivery is best-effort and still depends on browser permission, service-worker support and the existing delivery infrastructure.
- Priority scores are presentation guidance, not a promise of urgency or a financial-state assertion.

## Verification

- Phase 11 notification priority runtime tests: 14/14.
- Phase 11 account-isolation and independent in-app/push preference runtime tests: 16/16.
- Phase 11 source integration contracts: 19/19.
- Existing notification center contracts: 10/10.
- Notification list ordering contracts: 15/15.
- Notification RPC privilege contracts: 18/18.
- Notifications/filter UX contracts: 9/9.
- Attention intelligence contracts: 8/8.

## Outstanding acceptance

The environment has Node 22.16.0 while the repository requires Node 24.15.0, and dependencies are not installed. Therefore a dependency-backed typecheck, lint, production build, browser/device test, real push delivery, two-account shared-device test, live Supabase/Testnet/Mainnet acceptance and screen-reader test are not certified. No production approval is granted.

The existing multiple durable notification feeds (unified, social, economy and announcements) are still merged client-side for compatibility. A future consolidation should only proceed after per-source backfill/reconciliation, duplicate semantics, retention and actor/recipient privacy are validated against each target database.
