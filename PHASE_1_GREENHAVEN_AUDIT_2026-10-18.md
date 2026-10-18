# GreenHaven — Phase 1 Audit & Stabilization (2026-10-18)

## Scope and evidence
Reviewed the supplied `gh_latest_work` repository archive and the supplied preview recording. This is a source-level audit; no Vercel, Supabase, or Pi live session was available, so no live delivery/deployment claims are made.

## Confirmed findings

1. **Build blocker in offline story queue** — `lib/social/offline-story-flush.ts` accepted any string for `audience`, while `socialCreateStory` expects `StoryAudience`. Fixed by validating the queued value against the canonical five-value audience set (`everyone`, `followers`, `friends`, `matches-only`, `private`) and falling back to `undefined` for malformed/legacy values.
2. **Feed interaction presentation needs device-level review** — the preview recording visibly shows comment/share summary counts above the same post's action row, where comment count and share action are repeated. Some repetition may be deliberate; product decision should be one clear summary/action hierarchy. Existing static feed-card test currently passes and checks compact summary spacing, so verify the rendered implementation against the recording before changing the shared component.
3. **Scrolling needs real-device profiling** — CSS already contains `.gh-scroll-root`, `overscroll-behavior`, `-webkit-overflow-scrolling`, and `touch-action: pan-y`; therefore this is not safely solved by adding more global CSS. Trace nested scroll roots, viewport sizing, fixed/in-flow navigation, and gesture interception on Pi Browser/Android.
4. **Release notification is represented in source tests** — `scripts/test-notification-attention.mjs` includes checks that a release creates a reviewable system notification and that the version matches the package version. This does not prove existing users were notified in the deployed environment. Verify release trigger execution, eligible-recipient fan-out, durable persistence, RLS, read/unread behavior, and failure/retry telemetry in Testnet.
5. **Local dependency/typecheck environment is incomplete** — `npm run typecheck` could not run in this container because multiple installed `node_modules/@types` entries lack definitions (including `node`, `react`, `react-dom`, and others). This is an environment/install limitation, not proof that the source has further type errors. Reinstall from lockfile in a clean environment before judging the result.
6. **Dependency risk requires triage** — the supplied Vercel log reported 14 npm vulnerabilities (2 low, 1 moderate, 11 high), a deprecated package warning, an unsupported ESLint version warning, and an unknown `cache-dir` npm config warning. Do not run `npm audit fix --force` without reviewing the dependency tree and compatibility.

## Checks run in this environment

- `npm run check:jsx`: PASS, 655 files scanned.
- `node scripts/test-feed-card-layout.mjs`: PASS, 7/7.
- `node scripts/test-notification-attention.mjs`: PASS, 17/17.
- `npm run typecheck`: BLOCKED by incomplete local type-definition packages; must rerun after clean `npm ci --legacy-peer-deps`.
- Full production build: NOT VERIFIED in this environment.
- Live Vercel/Supabase/Pi verification: NOT PERFORMED.

## Three-phase delivery plan

### Phase 1 — Stabilize and establish evidence
- Fix the known story-audience type mismatch (implemented).
- Clean install and rerun typecheck/build plus focused safety tests.
- Trace post-card markup and event handlers to identify the exact source of repeated counters/actions before changing UI.
- Trace release announcement creation and recipient delivery from release event through durable notification records.
- Inventory scroll roots and test on Android/Pi Browser with long feed, media, modals, keyboard, and bottom navigation.
- Produce a prioritized defect register with file paths, severity, test evidence, and operator-only gates.

### Phase 2 — Core product experience
- Consolidate post summary and action hierarchy; preserve accurate counts and single action semantics.
- Improve notification center, durable system announcements to existing users, deduplication, unread state, retries, and deep links.
- Resolve measured scrolling issues at their actual owners rather than global CSS overrides.
- Regression-test feed, comments, shares, messaging, Discover, profile, and accessibility.

### Phase 3 — Performance and release hardening
- Profile rendering, media, pagination, network requests, and low-end Android performance.
- Review vulnerabilities and update dependencies in controlled, tested groups.
- Run complete CI, migration checks, social authorization, economy/ledger and Pi Testnet regression suites.
- Verify Vercel Preview + Supabase Testnet + Pi Testnet with operator evidence; keep Mainnet release gated until separately verified.

## Non-negotiable invariants
- Votes do not mint GHC; tips and verified reward transactions remain separate.
- Do not weaken auth, RLS, payment validation, identity resolution, or ledger idempotency to make tests pass.
- Do not claim notification delivery based only on source tests or a notification-center screenshot.
- Do not claim a successful build/deployment until the clean build and deployed Testnet are verified.
