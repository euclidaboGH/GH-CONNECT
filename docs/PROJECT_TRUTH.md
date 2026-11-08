## 0.330.49 — Phase 3 wallet, rewards and membership concurrency hardening (2026-11-08)

**Current source version:** `0.338.3`

This increment closes several Phase 3 financial-reliability gaps. Pi withdrawal reservation recovery now reports per-request reasons and unlock conditions, and only releases a Pi Testnet reservation when it is still `reserved`, has no provider payment/txid, has no execution start/lease and has zero execution attempts. Processing/uncertain requests remain protected until an authoritative provider result; timeouts do not forfeit earned funds. Wallet ledger history prioritizes human-readable reasons over opaque references, and the withdrawal request response no longer contradicts its own execution gate. GHC membership purchase now serializes entitlement preflight and debit per account and prevents duplicate active same-tier charges or active VVIP downgrades during concurrent requests. Reward claim replay by either pending-row ID or rewardId alias resolves to the one posted credit. Pi payment recovery now looks up and validates the provider object before binding its ID, checks payer identity/network/direction/amount, and requires a verified transaction and txid before completion; recovery is durably rate limited and no-store. The new SQL migration `20261108110001_phase3_wallet_rewards_membership_concurrency_recovery.sql` is REVIEW_REQUIRED and unapplied. Its 43-check source contract passes; existing targeted Phase 3 ledger, request guard, membership, payout lifecycle/settlement/execution, wallet recovery and cross-feature reconciliation contracts pass. Live PostgreSQL concurrency, authenticated Pi Testnet payment/entitlement recovery, actual 3π reservation reconciliation, Node 24.15.0 dependency-backed typecheck/lint/build and browser/device acceptance remain outstanding. Production remains NOT APPROVED.

---

## 0.330.48 — Project-wide maintenance programme (2026-11-08)

**Current source version:** `0.330.48`

The source baseline is retained from 0.330.46. This increment establishes `docs/PROJECT-WIDE-MAINTENANCE-150-0.330.48.md`: 15 product/system sections and 10 explicit engineering essentials each (150 total), with security, financial authority, migration approval and external acceptance guardrails. A stale Wallet source-contract assertion was corrected to match the current UI wording (“held against Pi withdrawal requests”); no wallet ledger, reservation, payout or payment behavior changed. The maintenance register contract passes 22/22, and the complete source regression chain passes when the Node 24 runtime gate is isolated. The normal prebuild correctly blocks under the available Node 22.16.0 runtime; Node 24.15.0, dependencies, live services and device acceptance remain unavailable. Production remains NOT APPROVED.

## Historical 0.330.46 — Phase 11.2.5 Push Secret and Privacy Hardening (2026-11-08)

**Current source version:** `0.330.46`

Phase 11.2.4 selects standards-based Web Push with VAPID as the provider-neutral protocol. Phase 11.2.5 adds AES-256-GCM encryption for endpoint and subscription key material before storage, cryptographic P-256 VAPID keypair matching, ciphertext-only outbox claims, generic privacy-safe payloads and opaque per-notification tags. Provider acceptance is distinguished from actual device display. The SQL remains a proposal outside `supabase/migrations`, not applied and not part of the migration manifest. The vetted `web-push` package could not be installed because the npm registry is unreachable in this environment; no sender, scheduled worker, deployment keys, provider receipts or offline delivery are configured. Three channels remain separate: server-backed in-app inbox, local browser alerts and remote Web Push (disabled). Focused source/runtime contracts are added. PostgreSQL/Testnet/Mainnet, Node 24 dependency-backed build, provider sender, offline device, multi-account, browser/mobile and screen-reader acceptance remain open. Production remains NOT APPROVED.

## 0.330.44 — Phase 11.2.3 Notification Preferences and Account/Device Boundaries (2026-11-08)

Phase 11.2.3 separates account-level in-app inbox preferences from browser/device-level local alert preferences. Authenticated GET/PATCH `/api/notifications/preferences` derives ownership from the server-verified session and persists account choices through the existing `gh_user_profiles.profile_payload.notificationPreferences` namespace when the durable profile store is configured. Browser alert choices are stored separately under account + browser-device local keys, so another device or another account on the same browser does not inherit them. Settings shows independent In-app and This device controls and refreshes browser permission state when the app regains focus/visibility. Browser permission remains an independent platform gate; denied permission must be changed in browser site settings. Legacy preference records remain readable for migration compatibility. No database migration, remote push provider, PushManager subscription lifecycle, or financial authority was added. Important limitation: profile payload persistence uses read/merge/upsert rather than a dedicated atomic preference store; concurrent profile payload writes can be last-write-wins. Cross-device sync requires the durable profile store and live acceptance. Remote Web Push remains NOT CONFIGURED. Focused preference source/runtime checks pass 17/17 and 12/12; prior notification action, priority, account-isolation, delivery, service-worker and RPC privilege suites pass. Node 24 dependency-backed build, live cross-device, mobile/browser/screen-reader and Testnet/Mainnet acceptance remain open. Production remains NOT APPROVED.

**Current source version:** `0.330.44`

---

## Historical 0.330.43 — Phase 11.2.2 Notification Delivery Architecture (2026-11-08)

Phase 11.2.2 distinguishes the server-backed authenticated in-app inbox, local browser alerts, and remote Web Push. The unified `/api/notifications` route uses the canonical server inbox RPC and reports its durable status; device-local storage remains a compatibility mirror. Browser alerts are local display attempts gated by account preferences and browser permission. The service worker has a push-event receiver, but the repository has no PushManager subscription registration/persistence, provider sender, VAPID configuration, or durable remote delivery outbox. Remote Web Push is therefore NOT CONFIGURED and offline delivery must not be claimed. Legacy smart-notification queue terminology now says browser alerts, duplicate local alert scheduling from the smart mirror is removed, and service-worker click navigation is constrained to same-origin/same-protocol URLs. No migration, provider, API authority, or financial boundary changed. Focused architecture/runtime checks are included in prebuild and verify:static. Node 24 dependency-backed build, real provider, browser/mobile, screen-reader, real two-account and live Supabase acceptance remain open. Production remains NOT APPROVED.

**Version at this historical release:** `0.330.43`


## 0.330.40 — Priority 10.2 shared filter state and server parity (2026-11-08)

Phase 10.2 introduces a shared, validated filter query contract for date, numeric, category, location range, sort, pagination and search inputs. Non-sensitive filter preferences are persisted under account-scoped browser keys for Communities, Rewards history and Activity; account changes cannot write one account's old state into another account's key. Marketplace public listing filters (AND-token search, category, listing kind, currency-specific GHC/PI price range, date range and sort) are executed in Postgres/PostgREST before bounded offset pagination. Authenticated wallet history supports inclusive UTC calendar-day date bounds plus allow-listed status/kind and AND-token text search in the server query while preserving its keyset cursor and owner check; Rewards requests only earned rows. Public Community search is implemented through `gh_community_search_public`, a new service-role-only RPC with full-text/category filtering, deterministic ordering and bounded pagination; migration `20261108120001_gh_community_server_filter_search.sql` is REVIEW_REQUIRED and unapplied, so filtered RPC use must wait for independent Testnet/Mainnet history reconciliation and disposable PostgreSQL validation. Communities, Rewards and Activity now use consistent filter summaries and semantics; Activity explicitly labels itself as the latest locally available bounded snapshot, not a complete ledger. The legacy Discovery FilterPanel had no mounted consumers and was removed from its public barrel exports and source. Filter result-state component covers loading, error, empty and no-results. Runtime tests pass 28/28 and integration contracts 34/34; Node 24 dependency-backed typecheck/build, live database/RPC, browser/mobile/keyboard/screen-reader acceptance remain outstanding. Production remains NOT APPROVED.

**Historical source version:** `0.330.39`

## 0.330.39 — Priority 10 coordinated filters (2026-11-07)

Priority 10 adds one shared accessible active-filter summary with per-filter removal and clear-all behavior across Feed, Discovery, Wallet, Messages, Marketplace and Notifications. Common bounded Unicode/diacritic-insensitive token matching is used by Feed, Discovery, Wallet transaction search and Messages inbox search. The legacy random-distance placeholder was removed; textual location matching does not claim geospatial radius. Focused utility tests pass 14/14 and source contracts pass 17/17. The shared filter foundation does not yet complete account-scoped persistence, server-side query parity, Communities/Rewards coverage or browser/device acceptance. No database migration or authorization change was made. Node 24.15.x build, accessibility/device and live acceptance remain open. Production remains NOT APPROVED.

**Historical source version:** `0.330.39`

## 0.330.38 — Priority 9.4 seller fulfilment and buyer tracking (2026-11-07)

Phase 9.4 adds durable fulfilment method (shipping, pickup or digital), carrier/tracking details, HTTPS tracking links, estimated delivery and dispatch timestamps. Sellers must record shipping details before starting a shipment, explicitly dispatch before marking it delivered, and digital fulfilment activates a service rather than claiming parcel delivery. Buyer completion remains gated on verified payment and persisted delivery/service activation. A database-enforced append-only trigger journal captures order creation, payment status, order status and delivery status; Phase 9.4 fulfilment events carry the authenticated participant actor. The activity timeline is available only to the order's buyer and seller. Legacy orders already in fulfilment retain a clearly labelled compatibility path without guessing their delivery method. The migration `20261107190001_marketplace_fulfilment_tracking_timeline.sql` is REVIEW_REQUIRED and unapplied. Parser tests pass 15/15 and source contracts pass 28/28. No PostgreSQL execution, shipping-provider verification, live Supabase, Pi/GHC Testnet, browser/device or Node 24.15.x build evidence exists. Production remains NOT APPROVED.

**Historical source version:** `0.330.38`

## 0.330.37 — Priority 9.3 true SKU variants and atomic inventory (2026-11-07)

Phase 9.3 adds dedicated durable SKU records with seller-scoped unique SKUs, per-variant price/currency/on-hand/reserved inventory, bounded seller authoring, buyer SKU selection, variant-aware cart line identity, variant-aware starting-price display, immutable order SKU/label snapshots, and variant-bound order creation. Listing publication and initial SKU rows share one database transaction to prevent a legacy-checkout race. Database transitions release reserved units on cancellation/expiry and commit units on verified payment; legacy order creation is blocked for active-variant listings to prevent inventory bypass. Seller variant replacement validates all rows before writes, preserves reserved units, refuses to deactivate variants with active reservations, and uses a consistent listing-before-variant lock order. The migration `20261107180001_marketplace_sku_variants_atomic_inventory.sql` is REVIEW_REQUIRED and unapplied. Static contract and parser tests pass 25/25 and 16/16 respectively; no disposable PostgreSQL concurrency, migration application, live Supabase, Pi/GHC Testnet, browser/device or Node 24.15 build evidence is available. Production remains NOT APPROVED.

**Historical source version:** `0.330.37`

## 0.330.36 — Priority 9.2 Seller Centre and product option foundations (2026-11-07)

Marketplace checkout now selects GHC versus Pi from the server-created durable order currency, never from a potentially stale listing/cart snapshot. Single-item purchase attempts use unique stable idempotency keys rather than a minute-based collision-prone key; keys remain available across uncertain payment retries and pending Pi handoff. If the order response omits or returns an unsupported currency, payment is not started and the buyer is directed to inspect Orders. Listing record hydration now treats missing inventory as zero instead of inventing one unit. Seller Centre exposes an explicit bounded stock quantity; zero remains zero, edits submit the seller's selected quantity, and an omitted stock field on server-side edits preserves the existing authoritative quantity. Listing delivery instructions now round-trip through the existing JSON metadata column and are returned by the listing API, so delivery mode/details survive refresh and device changes. No schema migration, financial authority, payment rail, order lifecycle or inventory reservation RPC was changed. Dedicated Phase 9 source/runtime contracts are registered in prebuild and static verification. Node 24.15.x dependency-backed typecheck/lint/build, browser/device acceptance, disposable PostgreSQL concurrency tests, live Supabase/Pi provider and Testnet operator acceptance remain outstanding. Production is NOT APPROVED.

**Historical source version:** `0.330.36`

Phase 9.2 adds seller-facing listing health indicators (low stock, drafts, incomplete catalog content), bounded product option authoring (up to four option groups and twelve values per group), durable option metadata, and buyer-visible option information with a clear message-to-confirm journey. Product options intentionally share the listing's authoritative price and stock in this increment; they are not independent SKUs or separate inventory pools. Independent variant prices/stock and variant-bound atomic reservation remain gated until the dedicated database/order contract is implemented and concurrency-tested.


## 0.330.34 — Priority 8 Messages security hardening (2026-11-07)

Completed the remaining source-level messaging abuse-control consistency work. Every messaging API rate-limit bucket now uses the shared Supabase-backed durable rate-limit control plane with fail-closed behavior when the RPC is unavailable: direct-conversation creation, inbox preference writes, conversation presence reads/writes, global presence heartbeats, messaging privacy preference reads/writes, community membership provisioning and read receipts. Existing quota values are preserved. No schema migration, financial authority or messaging data model was changed. The Priority 8 contract gate passes 49/49; messaging route scan finds no process-local `checkRateLimit` calls. Legacy messaging, inbox, media hydration, bounded JSON, private-surface durable-control and repository consistency checks pass. Node 24.15.x dependency-backed typecheck/lint/build, browser/device/screen-reader and live Supabase/Testnet acceptance remain outstanding. Production is NOT APPROVED.

**Current source version:** `0.330.34`

## 0.330.33 — Priority 8 Messages transformation (2026-11-07)

The Messages inbox now has a dedicated Archived lane while active inbox filters exclude archived conversations. Pin/archive/restore/mute/unmute actions use the authenticated server-side per-member preferences API, and the inbox hydrates those preferences across sessions/devices. Conversation-specific drafts survive thread close, app navigation, thread switching and network reconciliation; the previous thread draft is not deleted when opening another conversation. Conversation pin/archive/mute actions are available on touch layouts and keyboard focus, message actions are touch-visible and keyboard-reachable, message bubbles use group rather than false button semantics, and the composer enforces and displays the server's 8,000-character limit. Existing authenticated durable conversation/message storage, active membership checks, idempotent sends, owned-media validation, privacy, read receipts, presence and durable fail-closed message send/read controls remain canonical. Dedicated Priority 8 source contract passes 43/43; existing messaging, media, bounded JSON, private-surface, accessibility and repository checks pass. No migration or financial authority changed. Node 24.15.x dependency-backed typecheck/lint/build, browser/Android/Pi Browser/screen-reader and live Supabase/Testnet acceptance remain outstanding. Production is NOT APPROVED.

**Current source version:** `0.330.33`

## 0.330.32 — Priority 7 Communities governance and accessibility closeout (2026-11-07)

Community moderation history and safety reports now have authenticated server endpoints, moderator-only reads, server-derived actor identity, transactional moderator-role revalidation for audit appends, and durable report create/resolve RPC paths. Moderator UI hydrates durable history and report queues, retaining session fallback only when server data is unavailable. Key community controls use 44px touch targets, the community content region is keyboard-focusable and named, and reduced-motion preferences are respected. The migration `20261107170001_phase7_durable_community_governance.sql` is REVIEW_REQUIRED and unapplied; the server path requires server-only Supabase credentials and `GHC_GOVERNANCE_SERVER=1`. Phase 7 source closeout checks pass, but live DB/RLS, Node 24.15.x production build, browser/screen-reader/mobile-device and Testnet acceptance remain open. Production is NOT APPROVED.

**Current source version:** `0.330.32`

## 0.330.31 — Priority 7 Communities discovery and participation correctness (2026-11-07)

Community directory “Most members” sorting now uses the server aggregate member count instead of a partial member-ID projection. “Needs attention” and the Community pulse share a non-negative unread-count policy so legacy `unreadCount` is used only as a chat fallback and is not double-counted. Community event dates accept ISO strings, Unix seconds and millisecond timestamps; malformed dates remain unknown. External resource links reject embedded credentials while retaining the HTTPS/same-origin-relative allowlist. Community cards distinguish pending requests from new joins and expose canonical invitation acceptance/decline actions; approval-required and invite-only privacy modes remain distinct in the hub. No migration, membership/governance authority, chat policy or financial behavior changed. Priority 7 source/runtime contracts and consolidated `verify:static` pass (57/57); Node 24.15.x prebuild/typecheck/lint/build and browser/device/live infrastructure acceptance remain outstanding. Production is NOT APPROVED.

**Current source version:** `0.330.32`

## 0.330.30 — Priority 7 Communities transformation (2026-11-07)

Community participation pulse controls now open distinct Board, Chat and moderator-request focus filters instead of sending every action to the same generic unread sort. Legacy event rows without canonical IDs receive deterministic render keys; community event/resource URLs are restricted to HTTPS or safe same-origin relative paths in both normalization and rendering; malformed resource rows and ordering values are handled safely. Governance durability is now reported as session-only until a real server persistence path confirms a durable write, even when the optional mirror flag is enabled. No database migration, membership authority, chat policy, moderation decision authority, GHC/Pi financial behavior or entitlement behavior changed. Priority 7 source checks pass; Node 24.15.x dependency-backed typecheck/lint/build and browser/device/Testnet/operator acceptance remain outstanding. Production is NOT APPROVED.

**Current source version:** `0.330.30`

## 0.330.29 — Priority 6 Settings transformation (2026-11-07)

Settings now opens with a coordinated control-centre overview showing privacy posture, enabled notification categories, locale and appearance, with direct navigation to the corresponding subsections. Individual preference changes now submit narrow partial patches instead of spreading a stale render-time settings snapshot, preventing rapid toggles from overwriting unrelated values. Discovery radius and age ranges are bounded. Existing server-backed messaging privacy and delayed SDK persistence remain unchanged. No migration, financial action, permission grant or notification-delivery guarantee was added. Node 24.15.x build and external acceptance remain open. Production is NOT APPROVED.

**Current source version:** `0.330.29`

## 0.330.28 — Priority 5 Profile transformation (2026-11-07)

Public peer profiles retain server privacy-projected professional/business identity and portfolio data; cached discovery profiles are enriched from the canonical profile API with stale-request fencing; share links resolve to the exact profile; owner About presents professional/business work and durable achievements; authoritative follower/following counts remain unknown until loaded; and profile tabs expose improved ARIA relationships. No database migration, financial action or privacy-policy expansion occurred. Node 24.15.x build and external acceptance remain open. Production is NOT APPROVED.


## 0.330.27 — Priority 4 Membership completion increment (2026-11-07)

Membership now includes accessible category-filtered plan comparison, explicit term/savings disclosure for each separate GHC/Pi catalog price, server-derived remaining-term information, fail-closed purchase actions until membership status is authoritative, and accurate attribution of Pi/GHC/external/admin/trial membership sources. VVIP-to-VIP downgrades are blocked in the plan chooser, activation API and verified Pi grant path. An additive entitlement-row trigger migration provides database-level protection against direct-RPC/concurrent downgrades; it is REVIEW_REQUIRED and unapplied pending remote history reconciliation and disposable PostgreSQL validation. No migration was applied and no payment, ledger or provider transaction was run. Static contracts pass; Node 24.15.x build and external acceptance remain open. Production is NOT APPROVED.

**Historical release version:** `0.330.27`
**Current status at that historical release:** **NOT APPROVED** for production release.

## 0.330.26 — Priority 4 Membership product transformation (2026-11-07)

Membership plan comparison now derives from canonical tier/entitlement data and selected-duration GHC/Pi pricing. The active-plan journey no longer advertises a broken same-tier Renew action; it routes Free/VIP/VVIP members to meaningful next steps while preserving the server's active-same-tier no-charge behavior. Purchase review presents separate exact GHC and Pi catalog prices and accurately describes one-time prepaid terms. Current-plan benefits are generated from the canonical catalog, the false paid-plan boost statement and universal Free-account recovery prompt are removed, and membership activity can expand to the existing 20-event response, the current plan view shows the server-confirmed start date, and the comparison table has an accessible caption. The consolidated static verification suite passes 57/57. No payment/entitlement authority, price catalog, API, migration, ledger, provider or recurring billing behavior changed. Targeted Membership source contracts pass. Node 24.15.x dependency-backed typecheck/lint/build, browser/device, database and Testnet/operator acceptance remain outstanding. Production is NOT APPROVED.

**Release version:** `0.330.26`
**Current status at that historical release:** **NOT APPROVED** for production release.

## 0.330.25 — Priority 3 Rewards and Wallet trust UX (2026-11-07)

Priority 3 Rewards transformation increment: the Rewards overview separates locally tracked claim-ready records from records under review/maturity, explicitly describes the current non-financial mission achievement policy, preserves separate GHC and Pi cashback journeys, and now supports stable keyset-paged ledger history with account-switch isolation and deterministic timestamp-plus-ID keyset pagination. Claim feedback distinguishes server acceptance from confirmed ledger refresh, and mission progress is labelled as guidance rather than durable proof. All seven existing server-verifiable mission codes have explicit Rewards cards; unsupported mission types are gated rather than shown as finishable. Wallet adds a discoverable **Security & PIN** destination with a dedicated withdrawal-PIN manager. The manager reads authenticated server status, enables first-time setup only when the server confirms no PIN exists, requires matching six-digit values, uses the existing insert-only server action, and exposes the existing recovery flow after setup. Pi balance copy now distinguishes available balance, eligible-to-withdraw amount and reservations, and explains that only unstarted payout requests can be released. No balance, ledger, payout, issuance or settlement authority changed; no migration was added or applied.

The user-reported Pi available-to-reserved movements are **not reconciled** by this UI increment. Each affected account still requires authoritative ledger, payout-request and provider-state investigation. Node 24.15.x typecheck/lint/build and browser/device/Testnet acceptance remain outstanding.

**Historical release version:** `0.330.25`
**Current status:** **NOT APPROVED** for production release.

## 0.330.23 — Feed source closure and roadmap realignment (2026-11-07)

The coordinated Feed source scope is closed for this product increment. The existing 0.330.19–0.330.22 implementation has passing targeted source contracts for Feed transformation, discovery, composer journey, ranking transparency, pagination, reduced-data behavior, reconciliation and accessibility. The approved product roadmap is restored to the user's 11 priorities; Rewards is Priority 3 and the next coordinated product transformation. This release aligns source truth and roadmap documentation; it does not claim browser/device or production acceptance.

Critical Wallet follow-up remains open: investigate Pi available-to-reserved balance movements from authoritative records, and expose the existing six-digit withdrawal PIN setup through a discoverable Wallet security entry. The device-unlock PIN is separate. No reserved funds were reclassified or released, and no financial authority or migration changed.

**Release version:** `0.330.23`


## 0.330.22 — Feed relevance transparency and durable local feedback (2026-11-07)

The Feed post-card relevance label now opens a real accessible, focus-managed explanation dialog. Users can see the current ranking reason, understand that relevance ordering does not change post visibility permissions, and choose “See fewer like this.” The action reuses the existing client-side Feed exclusion behavior and persists a unique bounded set of up to 200 post IDs on the current device. No new backend ranking preference, migration, visibility rule, social mutation authority, wallet or payment behavior was introduced. Targeted Feed regression checks pass. Node 24.15.x dependency-backed typecheck/lint/build and physical browser/device acceptance remain outstanding; production remains NOT APPROVED.

## 0.330.21 — Phase 2 Wallet completion increment (2026-11-07)

GHC transaction receipts now surface additional allowlisted durable correlation references from existing row metadata (order, reward, request, payment-intent, correlation and provider-payment identifiers), while retaining the explicit in-app-ledger receipt disclaimer. Wallet history provides one shared search field across independently selected GHC and Pi rails; switching to Pi history initiates its existing authenticated, read-only history load, and records remain separately rendered and selectable. GHC month-to-date insights now count only posted settled movement, exclude request-only rows and terminal failed/reversed/cancelled/expired entries, and report pending amounts separately. Send/Receive/Request and Pi Withdraw remain on their existing canonical flows. No database migration, financial mutation authority, payout, transfer, payment or entitlement contract changed. Responsive layout checks are source-level only; actual low-end Android, WebView and Pi Browser acceptance remains pending. Node 24.15.x typecheck, lint and production build remain required; production remains NOT APPROVED.


**Release version:** `0.330.21`

## 0.330.9 — Build-gate continuity (curation language + version truth)

Source continues the Phase 4–5 wallet withdrawal form stability work and synchronizes release metadata so prebuild gates (Phase 9 membership, Phase 16 post interactions, Pass 43 domain bridges) accept the active package version. Post engagement toolbar uses concise **Community curation** product language. No new database migration, ledger mutation, or Mainnet A2U enablement. Production remains NOT APPROVED pending external acceptance gates.


## 0.330.19 — Cross-surface interaction reliability (2026-11-07)

Notification hydration is now session-identity scoped: an account switch clears prior-account rows and unread counts, aborts in-flight requests, and fences late responses so they cannot overwrite the new account's notification state. Feed, inbox, community and marketplace filter controls now expose their selected state with appropriate accessible semantics. This increment does not change wallet balances, GHC/Pi ledgers, reward issuance, membership entitlement, messaging persistence, marketplace order/payment authority or database migrations. Source-level verification is registered in prebuild and static verification; Node 24.15.x runtime/build and browser/device acceptance remain required. Production remains NOT APPROVED.

## 0.330.2 — Phase 26 cache-safe CI and release hygiene

TypeScript incremental metadata now writes to `.cache/tsconfig.tsbuildinfo`, and `.cache/` is ignored alongside all `*.tsbuildinfo` files. The Phase 26 wallet-ledger resilience check recursively discovers build-info artifacts and, in a Git checkout, confirms each is ignored and not tracked. It rejects the legacy root `tsconfig.tsbuildinfo` path and fails closed if a cache is present outside a Git-verifiable workspace. This prevents CI from failing merely because a correctly ignored incremental cache was generated before the gate. Existing wallet timeout/cancellation and Pi/GHC separation contracts remain unchanged. No migration, ledger, payment, entitlement or production authority changed. Production remains NOT APPROVED pending all external acceptance gates.

## 0.330.1 — Phase 10 CI regression-contract repair

The release retains the 0.330.0 Settings/media/navigation work and corrects stale regression contracts: PI wallet action validation matches the implemented dedicated Withdraw action, Stories own-story ring validation matches the actual emerald treatment, and the legacy Phase 5 release-readiness check dynamically validates the current package/manifest versions rather than hardcoding 0.312.0. Generic image URL mutation is removed to preserve signed storage/CDN URLs and private media facade identifiers. Infinite-scroll locks now span asynchronous page loads, preventing duplicate pagination requests; older embedded WebViews without IntersectionObserver receive visible content. The 0.329.0 public-static service-worker policy and reduced-data prefetch controls remain in force. This is a source-level UX/performance increment only; no database migration, Pi payment, GHC ledger, entitlement, or production authority is changed. Phase 9 Membership acceptance remains open, and the release remains NOT APPROVED until supported-runtime, database, Testnet, browser/device and operator gates pass.

## Current authoritative metadata

- Package and lockfile version: `0.338.1`.
- Runtime: Node `24.15.0` / package engine `^24.15.0`.
- Canonical Supabase migrations: **192** SQL files.
- Duplicate migration numeric prefixes: **0**.
- Migration source manifest: synchronized with all 191 canonical migrations.
- No local secret `.env` file is included; `.env.example` is the only env template.

## Current source/audit status

The 0.319.0 increment adds editable professional/creator/business identity, a public portfolio and experience showcase, account-scoped server achievements, explainable discovery relevance from professional interests, and privacy-filtered public identity projections. The 0.320.0 Phase 7 Wallet source implementation is closed: its Pi withdrawable snapshot read is abortable, time-bounded and strictly validated. External Node 24.15.x typecheck/lint/build, browser/device acceptance and live Pi Testnet reconciliation remain production release blockers. Phase 8 Rewards source implementation is closed in 0.323.0: premium account-scoped Rewards hydration, server-authoritative daily claims, authenticated cross-device GHC ledger history/search/filtering, and seven durable server-verified idempotent mission achievement unlocks. Mission achievements are non-financial; GHC activity issuance remains disabled by the current policy. The new additive mission-verification migration is REVIEW_REQUIRED and not applied. Node 24 build, disposable PostgreSQL/Testnet, browser/device and operator acceptance remain outstanding. No GHC/Pi financial execution authority changed.


The 0.289.0 internationalisation engine builds on the 0.288.0 Global Language Foundation. Locale preferences are saved locally and reflected in document language/direction and regional API headers; formatters use Intl APIs. At v0.289.0, English was the only complete UI translation catalog; the v0.292.0 preview packs are separately identified as partial and are not represented as complete translations. No automatic content translation or database migration was added.

The 0.290.0 Phase 3 language pack adds preview translations for persistent navigation and essential language-status copy in Hausa, Igbo, Yoruba and Nigerian Pidgin. Navigation labels and accessible names follow the selected locale. Translation coverage is intentionally reported as partial: the wider application remains English until each feature area is translated and native reviewers approve terminology. English remains the safe fallback for unsupported locales. User-generated content is not machine-translated, and no database migration or financial/authentication change was introduced.


The 0.292.0 Phase 5 experience-localisation increment extends the preview catalogs into feed filters, feed search and personalisation controls, discovery categories and accessibility/offline states, and time-of-day home greetings. Hausa, Igbo, Yoruba and Nigerian Pidgin remain partial preview packs; missing strings fall back to English. No user-authored content, private messages, legal text, identity/security instructions, wallet balances, payment states or transaction rules are translated. No database, authentication or financial logic was changed.

The 0.288.0 Global Language Foundation retains all 36 previously catalogued countries and adds 24 approved country records, resulting in ten countries per continent. It introduces 240 country-language recommendations (four per country), standardized locale tags, native display names where confidently available, script direction metadata and a fail-closed validation gate. All recommendations remain pending human review; no translations are claimed complete. The location picker supports manual region and locality entry where verified subdivision seeds are not yet available. No database migration or existing user-location rewrite was required.


The 2026-11-01 Phase 1 foundation pass reconciled release metadata and documentation hygiene, repaired the marketplace shared-mapper regression contract, and restored the missing source-only verification fixture. Pass 44 then moved 10 high-impact financial/payment routes to the existing Supabase-backed durable rate-limit control plane with fail-closed behavior when that service is unavailable. The complete network/database-independent static suite passed **57/57** after these changes. See `docs/PHASE-1-FOUNDATION-UPGRADE-0.265.0.md` and `docs/PASS-44-DURABLE-ABUSE-CONTROL-HARDENING-2026-11-01.md` for scope, evidence, and remaining runtime/operator gates. Pass 45 adds bounded, opportunistic cleanup for expired durable rate-limit buckets and explicitly expired security events, defaults new security events to a 90-day expiry, and validates limiter inputs and RPC result shapes before accepting decisions. Its new migration is `REVIEW_REQUIRED`; it must be reconciled and tested before application. See `docs/PASS-45-SECURITY-CONTROL-PLANE-RETENTION-2026-11-01.md`. Pass 46 distinguishes exhausted quotas (HTTP 429) from unavailable durable protection (HTTP 503), extends fail-closed handling to social mute/block writes, and adds a keyboard, reduced-motion and mobile interaction quality baseline. Pass 47 adds global offline/reconnect feedback, consistent feed/tab loading surfaces, and safer root error diagnostics. No Cloudflare/R2 integration was performed. See `docs/PASS-46-APP-EXPERIENCE-AND-SECURITY-RESILIENCE-2026-11-01.md` and `docs/PASS-47-APP-EXPERIENCE-COHESION-2026-11-01.md`. Pass 48 makes inactive primary-tab panels and hidden bottom navigation inert so keyboard focus cannot enter hidden surfaces. See `docs/PASS-48-ACCESSIBLE-NAVIGATION-2026-11-01.md`.


The current source tree has passed the repository-level contracts covering release hygiene, migration manifest synchronization, regional context, section refresh, shell/realtime/scroll behavior, post/curation production behavior, wallet/notification wiring, community governance, and residual technical-debt hardening. Pass 40 additionally centralizes feed replacement and pagination reconciliation in a shared, runtime-tested social-domain helper. Pass 41 hardens saved-listing, seller-listing, and durable-order hydration against stale responses and transient data loss, and adds latest-request-wins cancellation to feed refreshes. Pass 42 moves marketplace API record normalization out of the UI into shared, runtime-tested domain-boundary mappers for saved listings, seller/public listings, and durable orders, preserving explicit zero values and server-authoritative order/payment lifecycle fields. Pass 43 activates the Feed, Connections, and Discovery read seams against the current block/mute-filtered GHC session, excludes drafts and scheduled posts from the feed bridge, computes incoming request counts, and fails closed for production discovery candidates unless they are explicitly marked server-hydrated.

The corrected release archive must keep the Next.js application at repository root (`app/` directly under the repository root). Do not add an extra wrapper directory around the project.

## Navigation contract

- Canonical navigation: **Home · Discover · Messages · Communities · Cart · Profile** (visible bottom bar). Historical five-item baseline remains documented as Home · Messages · Communities · Cart · Profile. Wallet remains an overlay.

## Release boundary

Static/source verification **does not establish** a supported-runtime production build, live Vercel behavior, applied Supabase migrations, live Pi authentication/payment/provider behavior, realtime deployment configuration, or operator approval.

Before release:
1. Use Node `24.15.x` or another supported Node 24 release.
2. Run the locked dependency install and the project's typecheck/lint/build gates.
3. Reconcile Testnet/Mainnet migration history before applying SQL.
4. Complete live/disposable Testnet and provider evidence for the relevant payment, identity, messaging, media, realtime and financial workflows.
5. Keep Mainnet changes separately approved; never infer approval from source-only checks.

## Documentation authority

Use `docs/SOURCE_OF_TRUTH.md` for prompt execution and document precedence. Old worklogs and historical phase documents are not current product authority. If a legacy verification fixture conflicts with executable source or current release documentation, the source/current release documentation wins and the fixture should be repaired rather than the product being regressed.

## Source-only evidence language

The **source migration inventory is not evidence of applied migrations**. It does NOT prove migrations are applied to any Supabase project.

The supported runtime is `^24.15.0`. **TypeScript, lint, and Next.js production build** must be executed with the supported Node 24 runtime and installed locked dependencies before production acceptance.

The 0.292.0 Phase 4 product-surface localisation extends preview strings to messaging inbox headings/filters, community discovery labels/search, marketplace navigation/search and settings discovery. The four Nigerian locale packs remain partial and require native-speaker review. English remains the fallback for untranslated keys and unsupported locales. No user-authored content translation, database migration, authentication change, wallet change or financial logic change was introduced.


## 0.293.0 Phase 6 — workflow localisation and review governance
The phase adds typed preview translations to the post composer, profile editor, community-board explanation, marketplace listing form and wallet transaction-history heading. It introduces a native-speaker review gate requiring reviewer identity, review timestamp, exact catalog version and product-owner approval. All Hausa, Igbo, Yoruba and Nigerian Pidgin packs remain partial and pending review. User-generated content, private messages, profile-authored text, listing descriptions, financial amounts, currency codes, fees, payment states and transaction identifiers are not automatically translated or recalculated. No database, authentication, wallet-ledger or payment logic changes are included.


## 0.294.0 Phase 7 — social-surface localisation
The notification centre and GH Pulse short-video experience now consume a typed social-message catalog for Hausa, Igbo, Yoruba and Nigerian Pidgin preview packs. Core notification controls, accessibility names, offline/unavailable feedback, empty states, video modes and playback controls follow the selected regional language. Locale changes update short-video labels without remounting the experience. Server-authored notification content, user posts, captions and author names remain untouched. The catalog version is 4 and the native-review gate is version-bound; all four packs remain partial and pending review. No database, authentication, wallet, payment or financial logic changed. The social translation regression gate passes 13/13.


## 0.295.0 Phase 8 — locale presentation and formatting

Added a shared formatting toolkit for compact numeric display, percentages, measurement units, relative time, plural forms, and locale-aware text comparison. Regional context exposes locale presentation metadata including text direction, numbering system, calendar and hour cycle. These functions are display-only and do not mutate canonical identifiers, amounts, currency codes, ledger records or payment state. Catalog version 5 is pending native-speaker/product-owner review; no preview locale is promoted to complete.


## 0.296.0 Phase 9 — RTL and accessibility foundation

The app already applies canonical locale direction to the document root. This phase strengthens that foundation with logical-property styling primitives, a locale-aware keyboard skip link, bidi-isolated notification count values, high-contrast and forced-colors support, and readable-copy/reflow utilities. Directional icon flipping is opt-in through `.gh-directional-icon`; non-directional icons are never globally mirrored. Numeric notification counts use isolated LTR rendering while their surrounding labels inherit the selected locale direction. Translation catalog version 6 must be reviewed before any preview language can be approved. No database, auth, wallet, payment or financial logic was changed.


## 0.297.0 Phase 10 — accessible interaction system

Shared status semantics now cover lazy-screen loading, navigation announcements and localized main landmark naming. Interactive controls receive a 44px minimum target baseline, focus-visible indicators are consistent, reduced-motion preferences suppress nonessential animation, and forced-colors mode retains focus/error affordances. Catalog version 7 is pending renewed review. Source checks do not replace browser/screen-reader validation.


## 0.298.0 Phase 12 — global locale integration

Explicit locale choices now survive localStorage failures for the active session, including later visibility/language refreshes. Cross-tab preference changes and reset behavior synchronize the in-memory fallback. Unit and plural formatters have defensive fallback behavior. The Phase 12 source gate covers locale lifecycle, document metadata, regional headers, preview translation governance and financial-display boundaries. This does not promote preview packs or replace browser/native-speaker acceptance.


## 0.300.0 Phase 13 — social Stories and profile media

The Stories rail is now a restrained horizontal strip of compact vertical cards. Existing profile and cover photos open in the shared full-screen media viewer; editing is a separate action. Story image/video viewing resolves private-media facade references through the viewer-authorized URL path. Existing story audience, publishing, reply, reaction, and viewer contracts remain in place. The Phase 13 source UX gate passes 13/13; device and production acceptance remain pending.


## 0.300.0 Phase 14 — creator media preview

The post composer now provides full-screen previews for selected image attachments and inline playback for attached videos. Story images can be opened in the shared full-screen media viewer; Story videos use the private-media-aware DurableVideo component. Preview and removal are distinct actions. Uploading and publishing remain owned by the existing compose pipeline. The Phase 14 source gate validates these boundaries; browser/device acceptance remains pending. No database, authentication, wallet, Pi, GHC or financial contracts changed.


## 0.302.0 Phase 16 — post interaction experience

Comment image attachments open in a full-size proportion-preserving viewer; video attachments open in a dedicated playback preview, with download actions kept separate. The comments dialog now provides an announced loading skeleton, traps keyboard focus, locks background scrolling and restores focus on close. Post curation language is simplified without changing curation weights, vote persistence, server authorization, comments, reactions, sharing or moderation. The Phase 16 source gate validates these UI and accessibility contracts; browser/device acceptance remains pending. No database, authentication, wallet, Pi, GHC or financial logic changed.

## 0.301.0 Phase 15 — feed experience refinement

The shared feed/profile composer has been simplified into one clear text-entry action with two focused media shortcuts (photo and video). Decorative gradients and the redundant feeling shortcut were removed. Feed discovery prompts now appear at a lower cadence (once per twelve displayed posts), use a compact inline presentation for people discovery, and are suppressed in focus mode and non-personalized feed filters. The canonical create hub, feed ranking, server hydration, post actions, media authorization and domain contracts are unchanged. Phase 15 source checks cover the presentation and boundary contracts; device/browser acceptance remains outstanding. No database, authentication, wallet, Pi, GHC or financial logic changed.


## 0.304.0 Phase 18 — private-media session isolation and account privacy controls

The browser-side signed-media cache is scoped to the active GreenHaven identity/authentication epoch. Identity changes clear cached/in-flight resolutions and notify mounted image/video surfaces to discard prior playback URLs and resolve again under the new session. Settings → Privacy & Safety now exposes a downloadable JSON account export and a typed-confirmation deletion request. Both actions require the existing server-side recent step-up contract. Export remains an explicit allowlist of supported GreenHaven records and fails closed rather than returning a partial export. Deletion intake records a request only; no destructive deletion, wallet forfeiture, payment, or settlement is performed by the request endpoint. No migration was added or applied.

Verification: Phase 18 source contract 18/18; the consolidated static suite is rerun and tracked in the current release worklog. Supported-runtime Node 24.15.x typecheck, lint, production build, browser/device verification and live provider/database checks remain separate release gates.


## 0.305.0 Phase 19 — creator economy and engagement integrity

Creator tip idempotency now follows a user-action key when supplied through `Idempotency-Key` or the bounded request body. Reusing a key is retry-safe; a fresh key enables a distinct later tip to the same creator at the same amount. Legacy clients retain the prior deterministic fallback. Creator economy summaries now require all four contributing data sources (PI tips, GHC tips, post rewards and creator ledger) to return valid collection payloads before publishing combined totals. Creator post reads reject malformed upstream shapes, the creator endpoint exposes per-source health, and Creator Studio suppresses unknown totals rather than rendering fabricated zeros.

Verification: Phase 19 creator commerce integrity source contract 17/17; tip idempotency runtime checks cover stable retries, distinct repeat tips, legacy fallback and invalid-key rejection. No migration was added; the canonical migration count remains 175. This source-only evidence does not establish live provider, database, payout, TypeScript, lint, browser or production-build acceptance.


## 0.306.0 Phase 20 — durable seller payout abuse controls

All twelve seller payout and banking API routes now use the shared database-backed rate limiter with an explicit deny-on-unavailable policy. This removes process-local limiter dependence from payout request intake/history, bank directory/account resolution, beneficiary create/disable, bank transfer execution, PI/GHC/bank reconciliation, operator transitions and exception resolution. Rate-limit storage outages now return the control-plane unavailable response rather than silently falling back to per-instance counters. Existing recent-step-up checks, operator secrets, payout idempotency, provider amount/recipient/reference verification, treasury funding checks and atomic settlement RPCs remain authoritative. No migration was added; the canonical migration inventory remains 175.

Verification: `check:phase20-payout-durable-limits` validates all 12 route contracts, fail-closed behavior, durable status/error mapping, and migration inventory uniqueness. This is source-level verification only; it does not prove live Supabase RPC availability or provider settlement.


## 0.307.0 Phase 21 — private-surface durable abuse controls

Private messaging reads, sends, edits and deletes; private-media signed URL issuance, media resolution, direct-upload intent and buffered upload; and account export/deletion-request intake now use the shared database-backed rate-limit control plane. Each boundary awaits the limiter and denies the request with the explicit 503 unavailable contract if durable enforcement cannot be reached; exhausted quotas remain 429. This replaces process-local counters for these high-sensitivity surfaces without changing conversation membership, media viewer authorization, owned-attachment validation, recent-step-up requirements, account export completeness or deletion-request semantics.

A Phase 21 repository-integrity gate is registered in both `prebuild` and `verify:static`. It validates the ten durable boundaries, pipeline registration, package/lockfile version parity, migration-prefix uniqueness, and exact synchronization of the 175-file migration source manifest including byte counts. No database migration was added or applied. Verification remains source-level; supported-runtime typecheck, lint, production build, browser/device checks, live Supabase and provider acceptance are outstanding.


## 0.308.0 Phase 22 — atomic marketplace order transitions

Durable order-state changes now use `gh_marketplace_order_transition`, a service-role-only PostgreSQL function that locks the target order row with `FOR UPDATE`, validates the existing state transition matrix, records an audit event and returns the refreshed canonical order. The application no longer performs a database-backed read/modify/upsert for these transitions. If the RPC is unavailable or returns an invalid payload, the request fails closed; it does not fall back to process memory. The canonical order-read RPC now includes the commerce/delivery fields already present in the schema. Payment verification remains downstream of authoritative payment settlement; this RPC does not create GHC/Pi payments, refunds, escrow releases, wallet entries, ledger entries or payouts.

Verification: Phase 22 source gate checks row locking, service-role ACLs, fail-closed transport, canonical response use, pipeline registration, package/lockfile parity and migration uniqueness. The new migration is classified `REVIEW_REQUIRED`; it has not been applied. PostgreSQL execution/concurrency tests, migration-history reconciliation, Node 24 typecheck/lint/build, live Supabase/provider checks and browser/device acceptance remain outstanding. Production remains **NOT APPROVED**.


## 0.309.0 Phase 23 — migration and order-read integrity
- Added a source migration that makes the canonical marketplace order snapshot read side-effect free.
- Application order reads explicitly run reservation expiry cleanup before snapshot retrieval and fail closed if cleanup cannot be confirmed.
- Atomic transition and commerce RPCs can return order snapshots without running a global expiry sweep while holding an order-row lock, reducing cross-order lock contention/deadlock risk.
- Static migration audit checks canonical filenames, unique versions, non-empty files, and fixed search_path on every SECURITY DEFINER function definition.
- Migration remains REVIEW_REQUIRED; no database was connected or modified.


## 0.310.0 Phase 24 — final source and migration-operator review

The migration classification source is now synchronized across `MIGRATION-SOURCE-MANIFEST.csv`, `docs/MIGRATION_CHECKLIST.md`, `VERIFIED_MANIFEST.txt`, and the generated `supabase/TESTNET_APPLY_ORDER.md`. The previous hand-maintained Testnet apply sequence is replaced with a complete 177-entry review inventory, sorted by canonical migration identifier and explicitly distinguishing review, approval, validation hold, and proposal/no-apply states. A regression gate checks the classifications, guide rows, generated inventory, release version and critical phase-gate registration.

This is a source/documentation integrity completion only. It does not prove that any migration has been applied, that the target schema is compatible, or that PostgreSQL concurrency, Pi/Paystack providers, Testnet, Mainnet, browser/device journeys, or production build have passed. The 58 `REVIEW_REQUIRED`, 1 `REQUIRES_APPROVAL`, and 2 `PROPOSAL` classifications remain held. Production remains **NOT APPROVED**.


## 0.313.1 Final polish

Toast clearance, capped toast stack, version/docs sync. No financial authority changes.

## 0.313.0 Product UX track Phases 1–5 (trust → release)

Media facade story publish, Discover CTA/presence honesty, Communities My membership enrichment, feed soft-refresh + composer/stories polish, aggregated release gate. **SOURCE VERIFIED only** — Testnet migration `20261104180001` and A2U funding remain operator-owned.

## 0.312.0 Phase 26 — wallet ledger resilience and premium wallet experience

Wallet summary and Pi earnings reads are bounded, superseded requests are cancelled, timeout resources are cleaned up, and the PI dashboard uses latest-request-wins refresh sequencing. The wallet hero presents the selected asset rail and separates available, pending, locked, withdrawable and reserved figures. GHC is described as server-confirmed only when the validated snapshot is ready and server-sourced. `docs/CURRENT_BUILD_CONTEXT.md` is now the canonical concise brief for future build prompts; older worklogs and visual references are historical only. No SQL migration or financial mutation authority changed. Typecheck, lint, production build, live database/provider and device acceptance remain outstanding. Production remains **NOT APPROVED**.

## 0.312.0 Phase 27 — scroll immersion and creator analytics

- Bottom navigation now hides on upward content movement and returns on downward content movement, resolving the actual nested scroll owner rather than the tab wrapper. The hidden in-flow bar collapses fully and releases its reserved content inset.
- Curation and post insights are presented in an accessible modal sheet, not an inline expanding accordion. Analytics load only when opened, with a 10-second abort boundary and stale-response fencing.
- No SQL migration, GHC minting, vote economics, Pi settlement or wallet authority changed.


## 0.315.4 — Curation intelligence refresh recovery (source-only)

The curation intelligence refresh function in the prior source attempted to return a nonexistent `id` column from `gh_reputation_intelligence`; it also allowed missing reputation/calibration rows to overwrite initialized defaults with NULL. The additive correction removes the invalid return target and uses aggregate reads that always return a row with safe defaults. It preserves service-role-only execution, stored server-authoritative curation power, existing risk controls, atomic vote/reward/GHPV boundaries, and does not mutate GHC or wallet balances. The migration is `REVIEW_REQUIRED` and has not been applied. Testnet history reconciliation and disposable PostgreSQL validation are mandatory before application.

The full source-only verification suite passes on Node 22.16.0, but the project requires Node `^24.15.0`; TypeScript, lint, and production build remain unverified here. Live Supabase RPC behavior, snapshot creation, voting, curation rosters, and Testnet two-account behavior remain operator gates.


## 0.315.5 — Phase 1 social foundation (source-only)

Phase 1 revisits the social posting, voting, curation and community-board foundation. It adds a member-authorized, viewer-aware `gh_community_post_list` RPC and authenticated `/api/communities/[id]/posts` read endpoint. The RPC scopes records to the requested community, excludes deleted/archived posts, reuses canonical post-visibility enforcement, returns server-owned vote aggregates, reaction counts, saved state and the viewer's own curation/reaction choices, supports stable keyset pagination, and is executable only by `service_role`. The matching community client helper hydrates the hub from canonical social posts. Canonical community cards now reuse `EnhancedPostCard`, the same interaction component used by Feed/Profile, so voting, reactions, saving, comments and sharing use existing durable social endpoints. Legacy local-only `bpost_` / `local_` rows are explicitly read-only; they no longer display controls that imply durable voting. They must be republished by their authors to enter the canonical social ledger; the system does not impersonate authors or silently convert local data.

The existing curation intelligence refresh correction remains additive and `REVIEW_REQUIRED`. The new community-feed migration `20261106090001_gh_community_post_feed_canonical.sql` is also `REVIEW_REQUIRED`; it depends on the previously defined community role and canonical post visibility functions. Neither migration has been applied to Testnet or Mainnet. Reconcile each remote migration history, validate both migrations and query plans on disposable PostgreSQL, then run member/non-member, block, deleted-post, cursor, curation and two-account Testnet checks before application.

Verification completed for the 0.315.5 source baseline: full `npm run verify:static` passed, including the Phase 1 community/social contract (12/12), curation-intelligence recovery contract (10/10), existing post/curation production contract (12/12), and community global-standard contract (14/14). Migration inventory was 183 files at that release. TypeScript, ESLint, production build, live Supabase RPC behavior, and Testnet two-account/device acceptance were not certified.


## 0.315.6 — Phase 1 deep completion and reconciliation (source-only)

The Phase 1 deep pass aligns curation preflight with the canonical post-visibility function, so block, follower, mutual-follow, and active community-membership policy is consistent between reads and writes. It consistently denies self-curation, serializes the per-user daily curation cap across concurrent post votes, and makes activity-audit persistence mandatory in the same transaction as the vote and GHPV state update. The community-feed cursor now sorts on the same millisecond/id key it filters on. The community board preserves its last known-good canonical posts when a refresh fails, fences stale requests, and only clears a new-post draft after the parent confirms success.

The additive migration `20261106110001_phase1_curation_community_guard_reconciliation.sql` is `REVIEW_REQUIRED`. Together with `20261106080001_gh_reputation_intelligence_refresh_recovery.sql` and `20261106090001_gh_community_post_feed_canonical.sql`, it must be reconciled against Testnet and Mainnet migration histories independently and validated on disposable PostgreSQL before any application. No GHC issuance, Pi payment, wallet balance, payout, or financial settlement authority is changed.

Source verification: full `npm run verify:static` passed on the available Node 22.16.0 runtime; the consolidated static suite reported 57/57 and all registered targeted checks passed, including Phase 1 deep completion (16/16). Migration inventory is synchronized at 184 files with duplicate numeric prefixes 0. TypeScript, ESLint and production build remain unverified because Node 24.15.0 and installed dependencies are unavailable in this environment. Live PostgreSQL, Supabase RPC, Testnet concurrency, two-account access and device acceptance remain open. Production remains **NOT APPROVED**.


## 0.315.7 — Phase 2 Stories premium rebuild (source-only)

Stories now group multiple active stories by creator and play each creator's sequence chronologically. Story-seen state is account-scoped locally and hydrated from the durable server view ledger; successful durable empty-list responses clear stale cached stories. The viewer adds pause/resume, reduced-motion-aware progression, and video end progression. The story creator duplicate close control was removed. Story hydration now preserves server reaction counts and viewer reaction state.

The additive migration `20261106130001_gh_story_view_privacy_and_read_performance.sql` hardens direct story-view writes with the same audience and bidirectional-block policy as story reads, excludes author self-views, adds a viewer lookup index, returns server-confirmed seen state, and removes expiry mutation from the active-story read RPC. It is classified REVIEW_REQUIRED. Validate on disposable PostgreSQL, reconcile Testnet and Mainnet histories independently, and apply only after explicit operator approval. No live database operation was performed.

Source regression gate: `scripts/check-phase2-stories-premium-upgrade.mjs` (23/23), existing story rail gate (9/9), story/profile media gate (13/13), Phase 4 story shell gate (12/12). Full static verification still requires the remaining release-truth fixtures and supported-runtime checks to pass; TypeScript, lint, production build and live browser/database acceptance are not claimed here.


## 0.315.9 — Phase 4 Cart and Checkout premium upgrade (source-only)

The local marketplace cart now validates and bounds cached rows, consolidates duplicate listing IDs, synchronizes across tabs, and locks cart editing during checkout. Successful checkout removes only lines whose orders were durably reserved, preserving unrelated cart entries. Server-side order reservation and GHC/Pi payment authority remain unchanged. No SQL migration was added or applied. Static cart contract: 10/10; runtime cart assertions: 8/8. Supported-runtime build, live payment, Testnet and operator acceptance remain open.

## 0.315.8 — Phase 3 Marketplace premium upgrade (source-only)

Marketplace browse now supports product/service/opportunity and delivery-mode filters with a one-action reset. Price sorting keeps GHC and PI in separate currency groups rather than comparing nominal amounts across assets. Listing cards improve condition, availability and keyboard/reduced-motion feedback. Marketplace listing reports now submit through an authenticated, bounded, fail-closed server route using the durable rate-limit control plane and a service-role-only idempotent SQL RPC; the client confirms success only when the API reports a durable record. The additive migration `20261106150001_marketplace_listing_report_intake.sql` is REVIEW_REQUIRED and must be tested on disposable PostgreSQL and reconciled against Testnet/Mainnet histories independently before application. No order, inventory, payment, wallet, GHC, Pi, payout or settlement authority is changed.

Source regression gate: `scripts/check-phase3-marketplace-premium.mjs` plus currency-aware sorting runtime tests. Node 24.15.0 TypeScript, ESLint and production build gates, disposable PostgreSQL execution, Testnet moderation-queue review, and browser/device acceptance remain required; source checks do not establish production readiness.

## 0.319.0 Phase 6 completion and Phase 7 premium profile experience

Profile relationship state uses per-domain derived indexes over canonical social graph arrays; indexes are independently invalidated and batch-hydrated. Discovery cards consume prepared relationship states. Account switches abort stale profile pagination and identity hydration, clear previous-account counters, and reject late responses. Block-first safety and private financial-data boundaries remain intact. Phase 7 adds accessible reputation progress, localized number formatting, announced loading states and last-known-good recovery. No migration, identity authority, wallet, Pi, GHC or financial-authority change. Dedicated Phase 6/7 runtime and source checks pass; supported Node 24.15.x typecheck, lint, production build and browser/device acceptance remain pending.


## 0.322.0 Phase 8 — Rewards premium experience and ledger history

Rewards Centre snapshot reads are now bounded, abortable, authenticated and account-scoped. Invalid/null amounts remain unknown rather than becoming false zeroes, optional returned user identity is checked, and the UI exposes confirmed/loading/refreshing/unavailable states. Daily claim amount messaging accepts only a finite non-negative server-reported amount; it does not substitute local streak estimates. A failed daily claim cannot show a success flash. Reward issuance, idempotency, maturity and ledger authority remain server-side. No migration or financial authority changed.


## 0.323.0 Phase 8 Rewards source completion

The mission completion endpoint now derives the actor from verified server authentication, applies durable fail-closed rate limiting, parses a bounded request and ignores client metadata. Its service-role-only SQL verifier checks the seven supported mission proofs against durable membership, post, comment, profile and connection-request rows; advisory locking plus the existing unique achievement key make unlocks idempotent. It unlocks non-financial achievements only and always reports zero GHC. Migration `20261106170001_phase8_verified_mission_achievements.sql` is REVIEW_REQUIRED and unapplied. Phase 8 source work is closed; production approval remains pending Node 24.15.x build, disposable PostgreSQL/Testnet, browser/device and operator acceptance.


## 0.325.0 Phase 9 Membership foundation

Phase 9 begins with strict parsing of privileged membership entitlement rows, authenticated row identity checks, tier/source/period/active/timestamp validation, paid-expiry fail-closed rules (except explicit comp entitlements), expired/inactive paid normalization, bounded server/client status reads and rejection of conflicting purchase-duration inputs. GHC and Pi pricing/settlement authorities remain separate and server-owned. No migration or financial execution authority changed. Phase 9 remains active; Node 24.15.x, dependency-backed typecheck/lint/build, browser/device, disposable database/Testnet and operator acceptance remain outstanding.


## 0.326.0 Phase 9 Membership lifecycle and access control

Server-authoritative membership tier checks now protect catalog features before GHC debit. Premium membership presentation is based only on server status and includes authenticated read-only lifecycle history. The operator renewal workflow verifies the durable completed/fulfilled PI intent owner, provider, currency, purpose, canonical product and catalog amount; SQL derives the calendar access period including the bonus month, serializes renewal and enforces idempotency. A 72-hour continuity-only window preserves term alignment without granting access after expiry. Prepaid plans do not auto-renew; no recurring billing or refund authority was added. The lifecycle migration is REVIEW_REQUIRED and unapplied. Node 24.15.x typecheck/lint/build, disposable PostgreSQL/Testnet, browser/device and operator acceptance remain outstanding.


## Phase 9 current increment (0.327.0)

Strict Pi intent discrimination now protects activation, payment completion, fulfillment, recovery and payment-history reconciliation. Exact provider/currency/purpose/non-empty provider payment ID/completed state are required. Production Pi grants use the row-locked idempotent RPC with post-write confirmation; payment/fulfillment returns retryable pending status if entitlement is not confirmed. The generic GHC ledger-spend route also blocks premium boost/tool purposes until durable effects exist. The follow-up SQL renewal guard is REVIEW_REQUIRED and unapplied. Phase 9 source implementation is complete; external acceptance remains pending and no production approval is implied.



## 0.330.1 — Phase 10 navigation and media reliability
- Settings security/compliance/Pi capability/passkey/account-data panels are lazy-loaded with section-specific accessible fallbacks.
- Generic image URL mutation is removed so signed storage/CDN URLs and private media facade identifiers are preserved exactly.
- Infinite-scroll locks span the asynchronous page load; older WebViews without IntersectionObserver show content rather than leaving it deferred indefinitely.
- Focused navigation/media source gate: 9/9; runtime media/pagination tests: 7/7.
- No migration, Pi transaction, GHC debit, entitlement issuance or financial-authority change. Node 24.15.x build and browser/device acceptance remain outstanding. Production remains NOT APPROVED.

## 0.329.0 — Phase 10 resilience and media efficiency
- Service worker caches only explicitly allowlisted public static assets; navigations, API, media facades and personalized responses are network-only.
- Feed and Story prefetch respects reduced-data/Data Saver and constrained network conditions, rechecks at execution time and caps speculative work.
- Reconnect status timer is cleaned up on unmount.
- Added 17 static resilience assertions and 11 executable service-worker policy tests.
- No production migration, Pi transaction, GHC debit or entitlement issuance. Phase 9 external acceptance remains open.


## 0.330.29 — Priority 6 Settings transformation

Settings now has a coordinated control-centre landing overview with live summaries for privacy posture, enabled notification categories, appearance and locale, plus direct navigation to the corresponding subsections. Mutations use narrow partial patches to avoid stale render-time settings snapshots overwriting unrelated changes. Discovery radius and age-range inputs are bounded before state updates. Existing server-backed messaging privacy writes and delayed SDK user-state persistence remain unchanged. No migrations, financial operations, permission grants or notification-delivery guarantees were added. Source regression checks are registered in prebuild and static verification. Node 24.15.x dependency-backed typecheck/lint/build and browser/device/live-account acceptance remain outstanding. Production remains NOT APPROVED.

## User programme Phase 3 — Rewards & Membership (2026-11-08)

The 0.330.48 Phase 3 increment reuses the existing unified earnings ledger, server-authoritative GHC reward claim/maturity, mission evidence, separate PI cashback, keyset-paginated reward history, canonical VIP/VVIP catalog, verified payment-intent grants and entitlement lifecycle. It adds durable fail-closed per-account request limits to membership status, lifecycle history, payment-history reconciliation and activation before privileged work. The new source gate is registered in `prebuild` and `verify:static`. Targeted Rewards/Membership source and pure-policy suites pass; see `docs/PHASE-3-REWARDS-MEMBERSHIP-2026-11-08.md`. This is source implementation only: Node 24.15.0 build/typecheck/lint, remote migration reconciliation, disposable PostgreSQL concurrency, authenticated Testnet provider journeys and browser/device acceptance remain outstanding. No migration was added or applied, no financial state was modified, and production remains NOT APPROVED.
