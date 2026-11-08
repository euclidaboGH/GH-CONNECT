# GreenHaven — Source of Truth & Prompt Execution Rules

**Current source version:** `0.330.48`
**Status:** 0.330.48 Feed reliability plus Phase 3 Rewards & Membership request-guard hardening; NOT APPROVED as a production release until the explicit runtime, database, browser/device and operator gates are completed.

## Authority order

Read `docs/CURRENT_BUILD_CONTEXT.md` first for the current concise product/build brief. It supersedes older prompt notes and historical worklogs as the active implementation context.

When documents disagree, use this order and stop to reconcile conflicts rather than guessing:

1. **Executable source code** (`app/`, `components/`, `features/`, `hooks/`, `lib/`, `supabase/migrations/`).
2. **Current package/runtime metadata**: `package.json`, `package-lock.json`, `.nvmrc`, `vercel.json`.
3. **`docs/SOURCE_OF_TRUTH.md`** for project-wide release boundaries and prompt execution rules.
4. **`docs/PROJECT_TRUTH.md`** for current release metadata and verification limits.
5. **Current dated release/audit documents** (including the Phase 1 foundation audit) for the specific feature they cover.
6. **Referenced legacy verification documents** exist only because older regression scripts still validate them. They are historical fixtures, not current design authority.

## Prompt execution rule

Do **not** use an old worklog, phase note, archive note, or historical release document as the basis for changing current behavior when executable source disagrees with it.

For implementation prompts:
- inspect current source first;
- inspect the relevant current audit/release document second;
- treat legacy documents as background only;
- never resurrect a removed UI, route, migration, architecture, or product rule solely because an old document mentions it;
- if two current sources conflict, report the conflict before making a broad change.

## Current release facts

- Current source release: `0.330.48`; Phase 3 Rewards & Membership (2026-11-08) adds durable fail-closed rate limits to membership status, lifecycle history, payment-history reconciliation and activation. See `docs/PHASE-3-REWARDS-MEMBERSHIP-2026-11-08.md`. No migration or financial state changed. The 15-section / 150-essential maintenance register is `docs/PROJECT-WIDE-MAINTENANCE-150-0.330.48.md`; Priorities 1–9 have reached their current source transformation milestones, with documented external acceptance gates still open. Priority 10 Filters has coordinated source increments 0.330.39–0.330.41, including shared filter state, server-side query contracts and a held Community search migration. Phase 9.3 adds durable SKU variants and per-variant inventory reservation/commit/release. Phase 9.4 adds durable shipping/pickup/digital fulfilment metadata, explicit shipping dispatch before delivery, buyer receipt confirmation, and a participant-only order event timeline. The Phase 9.3 SKU, Phase 9.4 fulfilment and Phase 10.2 Community search migrations are REVIEW_REQUIRED and unapplied. PostgreSQL concurrency, payment/provider, Node 24 build, browser/device, live Supabase and Pi/GHC Testnet acceptance remain open.
- Priority 11 remote push and privacy hardening (0.330.46): standards-based Web Push/VAPID protocol; authenticated/rate-limited subscription API; AES-256-GCM encryption for endpoint and subscription key material; cryptographic VAPID keypair validation; ciphertext-only outbox claims; generic privacy-safe notification payloads; opaque per-notification tags; and explicit provider-accepted (not device-delivered) outcome semantics. SQL proposal is not applied. Vetted sender, deployment keys, scheduled worker and real provider/device acceptance remain outstanding; remote delivery stays disabled.
- Priority 11 preferences (0.330.44): account-level in-app choices use authenticated `/api/notifications/preferences` and the existing profile-payload store; browser-alert choices are kept in a separate account + browser-device local key. Permission is an independent browser gate, not a user preference. The account endpoint uses profile read/merge/upsert, not an atomic dedicated preferences table; concurrent profile payload writes can be last-write-wins. No migration was added. Remote Web Push remains NOT CONFIGURED.
- Cross-cutting invariants remain unchanged: public identity is sourced through privacy-projected profile APIs; private wallet, membership and balance data are not exposed publicly; GHC and Pi remain separate catalog prices and payment rails; VIP/VVIP remain prepaid, non-recurring terms. Marketplace Phase 9.4 does not settle payments, release escrow, issue refunds, pay out sellers, or mutate inventory. Priority 10.2 adds account-scoped filter preferences for Communities, Rewards history and Activity; canonical date/number/category/location-range parsing; Postgres-side Marketplace category/kind/currency-specific price/date/text filters; authenticated date/status/kind/search-filtered wallet history; and a service-role-only public Community search RPC migration held REVIEW_REQUIRED. The Discovery legacy FilterPanel was unused by the current screen and removed from both public barrels after a repository-wide consumer check. These filters do not change authorization or financial authority. Notification priority is presentation guidance; local caches and preferences are identity-scoped; durable notification reads remain server-authorized. The new priority model does not change push-provider guarantees.

- Historical source release reference: `0.330.32`.
- Canonical build prompt context: `docs/CURRENT_BUILD_CONTEXT.md`.

- Historical package version reference: `0.330.31`.
- Global i18n: `lib/i18n/index.ts`; locale preferences are device-persisted, formatting uses Intl, RTL is locale/script-driven, and English is the only approved UI translation bundle at this release.
- Node requirement: `^24.15.0`; `.nvmrc` is `24.15.0`.
- 0.295.0 includes partial Hausa, Igbo, Yoruba and Nigerian Pidgin preview translations across navigation, messaging inbox chrome, community discovery, marketplace navigation/search, settings discovery, feed filters/personalisation, discovery categories/offline states and home greetings. It does not claim full application translation or native-speaker approval.
- Canonical Supabase migrations: **196 SQL files** (including Phase 9.3 SKU inventory, Phase 9.4 fulfilment timeline and Phase 10.2 Community search migrations as REVIEW_REQUIRED/unapplied).
- Duplicate migration numeric prefixes: **0**.
- Migration source manifest: synchronized with the canonical directory.
- The latest repository archive was corrected to place the Next.js `app/` directory at repository root after a Vercel packaging failure caused by an extra wrapper directory.
- Static/source checks can pass without proving a Node 24 production build or live Supabase/Pi/Vercel behavior.
- Migrations are not considered applied merely because they exist in the repository. The curation-intelligence recovery, Phase 1 canonical community-feed, Phase 1 guard-reconciliation, and Phase 2 story-view privacy/read-performance migrations are REVIEW_REQUIRED and need independent Testnet/Mainnet history reconciliation plus disposable PostgreSQL validation.

- Phase 3 (0.315.8): Marketplace discovery filters, currency-safe price sorting, premium listing-card information hierarchy, seller-centre inventory/status management, and authenticated durable listing-report intake. The new report migration is REVIEW_REQUIRED; no commerce/payment/financial authority changes. See `docs/PHASE-3-MARKETPLACE-PREMIUM-UPGRADE-0.315.8.md`.
- Phase 4 (0.315.9): Cart cache validation/bounds, cross-tab synchronization, checkout interaction locking and selective cleanup after durable order reservation. No database migration or payment authority change. See `docs/PHASE-4-CART-CHECKOUT-PREMIUM-UPGRADE-0.315.9.md`.

- Priority 11 current delivery truth (0.330.46): authenticated unified inbox is server-backed; browser alerts are local-only; account-level in-app preferences sync through the authenticated profile payload store when durable storage is configured; browser-alert choices are account + device scoped. Profile payload read/merge/upsert is not an atomic dedicated preferences store and can be last-write-wins under concurrent profile writes. Browser permission is an independent platform gate. The service worker has a privacy-safe generic receiver; subscription APIs and hardened encrypted-storage schema proposal are present, but the proposal is unapplied. VAPID keypair validation and an operator key-generation script are in source; no deployment keys, vetted `web-push` sender or dispatch worker are configured. Remote Web Push is DISABLED. Do not claim offline delivery.
