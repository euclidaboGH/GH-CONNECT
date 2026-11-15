# GreenHaven Premium Social Experience — Six-Phase Engineering Roadmap

**Source of truth:** `GREENHAVEN-PHASE3-UPLOAD-RECOVERY-VIDEO-PERFORMANCE-IDEMPOTENCY-0.338.67-2026-11-14.zip`  
**Baseline version:** `gh-connect@0.338.69`  
**Design direction:** Quiet Premium Social — confident typography, restrained surfaces, excellent media, efficient interactions, and a recognizably GreenHaven identity.

## Principles that apply to every phase

- Keep one canonical post renderer. Current source uses `EnhancedPostCard` on Feed and Profile and wraps it in `CommunityCanonicalPostCard` for canonical community posts.
- Preserve durable media validation, viewer-aware visibility, server-authoritative writes, idempotency, moderation and account isolation.
- Never couple likes, views, shares or quality votes to direct GHC issuance. Reward eligibility remains server-authoritative.
- Do not add schema migrations until existing migration history and required RPCs are reconciled in the target Supabase environment.
- Use the supplied recordings as design references, not as instructions to clone Facebook or X pixel-for-pixel.
- Every phase requires source checks plus visual/browser tests. A static contract pass is not a substitute for runtime acceptance.

## Phase 1 — Canonical card design system and shared renderer

**Source implementation:** delivered 14 November 2026. **Release acceptance:** blocked pending supported Node 24 typecheck/lint/build and browser visual/E2E review; do not treat static contract passes as full acceptance.

**Goal:** Establish one polished, consistent post card across Feed, Profile, Community, Saved Posts and post-detail surfaces.

1. Inventory every use of `EnhancedPostCard`, legacy `PostCard`, archived/sample/board community cards, saved-post surfaces and post-detail views.
2. Map visual differences by surface before editing; identify which are intentional context differences versus duplicated implementation.
3. Define semantic design tokens for card surface, borders, spacing, typography, avatar size, media spacing, focus rings, hover states and dark mode.
4. Consolidate duplicate `.gh-post-card` CSS only after computed-style and responsive regression coverage exists. Preserve intentional surface and breakpoint variants; do not perform a blind search-and-delete of CSS rules.
5. Extract small presentational subcomponents only where props and ownership boundaries are clear. Keep mutation and privacy logic in the canonical integration layer.
6. Fix the quoted-post placeholder: `EnhancedPostCard` currently renders generic “Original post content preview...” text even though `quoteOf` is only a post ID in the canonical `Post` type. Replace it with a real visibility-aware original-post preview using a server endpoint that enforces the same viewer permissions; show a clear unavailable/deleted state when access is denied. Never fetch around privacy controls.
7. Align keyboard navigation, focus visibility, reduced motion, touch targets and screen-reader labels.

**Acceptance:** Every active post surface uses the shared card design; no fake quote content; no card-open/action conflicts; no changes to visibility or mutation authorization; responsive screenshots reviewed at mobile, tablet and desktop widths.

## Phase 2 — Social engagement and conversation quality

**Status:** in progress. The existing uncapped server aggregate path is retained, and an additional accessible pending/failure-feedback slice is now implemented. Two-account and runtime validation remain open.

1. Audit Like/multi-reaction, comment, reply, repost, quote, save and share semantics across surfaces.
2. Keep ordinary social reactions visually separate from GreenHaven quality curation and GHC-related contribution information.
3. Verify reaction aggregates are not capped by client-side row scans; the current source has a dedicated aggregate-bounds check.
4. Improve nested comment hierarchy, reply context, action feedback, pending/error states and accurate counts.
5. Verify optimistic state is reconciled with server-confirmed writes and is fenced against account switching.
6. Test two-account interactions, retry/idempotency behavior and notification consistency.

**Acceptance:** Every action has an honest pending/success/failure state and reconciles across separate accounts/devices; counts remain server-backed; no client-side financial authority.

## Phase 3 — Media, composition and creator tools

**Source implementation:** completed in 0.338.67 and verified/closed at source level in Run #305 / 0.338.68. Browser, device, full build and operational acceptance remain open.

1. Audit image/video galleries, PDFs, link previews, polls, drafts, scheduled content and media ownership.
2. Improve media composition and visual hierarchy without cropping away important content or breaking natural aspect ratios.
3. Preserve durable first-party media facade URLs and ownership/readiness checks.
4. Test upload cancellation, retry, incomplete-post cleanup, offline/reconnect behavior and duplicate-submit prevention.
5. Improve creator analytics presentation while keeping private or detailed reward data permission-scoped.
6. Provide accessible captions/alt text and robust video controls; respect reduced-data and reduced-motion settings.

**Acceptance:** All supported post types render consistently and persist across refresh; media ownership, idempotency and account-scoped draft rules remain intact.

## Phase 4 — Community posts and discussion consistency

**Source implementation:** complete in Run #306 / 0.338.69. Archived/sample/legacy post surfaces use the canonical read-only renderer (including disabled poll voting/challenge joining); New/Hot/Top ordering is distinct with pinned-first ordering; announcements are visually cohesive; moderator report resolution is server-first; and governance reads/writes use canonical `gh_community_*` tables/RPCs. Pagination remains complete from Run #305. **Release acceptance:** live migration reconciliation, supported Node 24 build and authenticated multi-account browser/device acceptance remain blocked.

1. Keep the canonical post renderer as the only visual authority for active, archived and sample post content; read-only history must never call social mutation APIs.
2. Preserve community identity, member-only context, pinned announcements, moderator actions and membership status.
3. Keep pagination stable, cursor-based, deduplicated and request-fenced.
4. Verify report create/review/resolve/dismiss against canonical server persistence and moderator role rechecks.
5. Preserve community membership authorization, private/invite-only boundaries and append-only moderation auditability.

**Acceptance:** Source implementation complete. Final acceptance still requires a clean supported-runtime build, live Testnet/Mainnet migration reconciliation, two-account moderation/report tests and browser/device verification. No production approval is implied.

## Phase 5 — Feed quality, discovery and user control

**Source implementation:** Run #308 / 0.338.71 closes the Phase 5 source work. Run #307 established Unicode-aware topic parsing, whole-interest matching, bounded relevance boosts, truthful ranking explanations, stable chronological ordering, strict older-only cursor progression, final short-page reveal, refresh cursor synchronization and account/request-generation fencing. Run #308 adds durable account-owned preferences for hidden posts, less-relevant posts, muted topics and feed tuning; an RLS-protected table with browser-role denial; service-role-only read/write RPCs; authenticated, bounded, rate-limited API routes; one-time import of existing device-local preferences; account-fenced debounced synchronization; and server-side application of saved exclusions. Feed cursors continue from the raw canonical server page so filtered rows cannot create loops. Topic normalization consistently handles Unicode combining marks and underscore/hyphen variants. Following and Latest remain chronological; For You retains explainable, contribution-oriented ranking and creator/topic/community discovery surfaces.

**Database migration:** `20261114100001_gh_feed_preferences_durable.sql` is included in the source bundle and classified `REVIEW_REQUIRED`. It is not applied. The live Testnet/Mainnet migration histories must be reconciled against the complete repository source inventory before this or any other migration is deployed.

1. Preserve canonical visibility, account identity, block/mute suppression and private/community boundaries before ranking.
2. Keep deterministic deduplication, keyset pagination, refresh synchronization and stale-account request fencing.
3. Make Hide, Not Interested, Mute and feed tuning account-owned and durable; expose honest device-only status if the durable service is unavailable.
4. Keep recommendation explanations tied to actual signals; avoid engagement-bait ranking and preserve chronological Following/Latest modes.
5. Continue to measure request fan-out, render work, data transfer and media prefetch on low-memory Android devices and constrained networks.

**Source acceptance:** Phase 5 implementation gates are registered and the focused source/runtime tests pass. **External release acceptance remains open:** migration review/application and postflight, Node 24.15.0 dependency-backed typecheck/lint/build, authenticated two-account cross-device preference tests, browser/Android/Pi Browser checks, and measured performance baselines. Production is not approved until those gates pass.

## Phase 6 — Performance, accessibility and release acceptance

**Source implementation:** Run #309 / 0.338.72 delivers the first coordinated Phase 6 hardening slice. The canonical feed route now runs independent post-visibility, durable-preference and mute reads concurrently while retaining fail-closed visibility/mute behavior. Public-profile hydration now resolves post-author and comment-author batches concurrently, retaining the existing row/depth/identity/response/time bounds and public-field allowlist. Feed pagination still advances from the raw canonical page. A Phase 6 source gate (20/20) and Playwright acceptance coverage were added for reduced motion, 320–1440px viewport overflow, keyboard focus traversal and offline/reconnect announcements. Existing privacy-safe RUM and Core Web Vitals p75 budgets remain the measurement foundation.

1. Continue profiling React renders, feed hydration, community pagination, image/video decode, JS transfer and media prefetch using measured traces before further optimization.
2. Remove only measured N+1 requests and redundant hydration; preserve canonical batched APIs, cancellation, account fencing and server authority.
3. Run low-memory Android and Pi Browser tests under constrained/slow networks, reduced-data mode, offline/reconnect and interrupted sessions; capture real device and network evidence.
4. Complete keyboard, screen-reader, contrast, touch-target, focus-order, safe-area and reduced-motion review across public and authenticated surfaces.
5. Run clean supported Node 24.15.0 install, typecheck, lint, prebuild checks and Next.js production build.
6. Run cross-account browser acceptance for post create/edit/archive/delete, reactions, comments, saves, quotes, media, private-community visibility and account switching. Use real authorized QA accounts only.
7. Reconcile Supabase migration histories and required RPCs before applying any migration; review RLS/security advisors, then verify the target state postflight.
8. Verify Vercel Preview runtime errors, build commit alignment, cache behavior and rollback readiness. Production release remains a separate approval decision.

**Source status:** Initial performance/accessibility hardening implemented; Phase 6 is not yet accepted. **External acceptance remains BLOCKED** until supported-runtime install/typecheck/lint/build, Playwright execution, authenticated cross-account journeys, device/network performance measurements, database/RPC readiness evidence, Vercel Preview verification and the existing release approval gates pass. Production remains NOT APPROVED.

## Execution order and delivery discipline

Each phase should be delivered as one coordinated change set with: source audit, minimal implementation, regression tests, accessibility/performance review, a change log, and explicit PASS/FAIL/BLOCKED evidence. Avoid parallel competing roadmaps and avoid marking a phase complete based only on a static script.
