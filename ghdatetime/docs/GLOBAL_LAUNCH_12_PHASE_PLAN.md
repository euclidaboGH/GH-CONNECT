# GreenHaven v0.150.1 — Global Launch 12-Phase Programme

**Source of truth:** uploaded GreenHaven v0.150.1 archive. This plan supplements the source and does not authorize production database, Mainnet, payment, or identity-contract changes.

## Reference-video principles

The supplied product walkthrough and reference-platform preview videos are design/behavior references, not instructions to clone competitors. Carry forward familiar interaction patterns from Facebook, WhatsApp, and X where they improve usability: clear navigation, content-first feed hierarchy, compact inbox rows, obvious unread states, contextual actions, readable profile structure, predictable composers, and loading placeholders that preserve layout. Keep GreenHaven's own identity, information architecture, community model, and differentiating features. Validate every observed flow against the actual source before changing it.

## Phase status

Statuses below are conservative. A phase is not complete because documentation exists or a static check passes; completion requires evidence for its acceptance gate.

| Phase | Scope | Status | Acceptance evidence |
|---|---|---|---|
| 01 | Project truth, release control, reproducible build | IN PROGRESS | Version metadata aligned; CI workflow added; supported Node 24 build and all baseline checks still need execution |
| 02 | Security, identity, privacy, authorization | IN PROGRESS | Static source guards cover bounded limiter state and fail-closed durable throttling for Pi authentication; ASVS-based review, cross-user access tests, secrets and signed-media review remain outstanding |
| 03 | Database integrity and recovery | IN PROGRESS | Static migration inventory synchronized and recovery verifier regression checks pass; isolated restore and migration replay evidence still outstanding |
| 04 | CI/CD, environment isolation, release engineering | IN PROGRESS | Initial CI workflow added; successful pipeline run, protected environments and rollback rehearsal outstanding |
| 05 | GreenHaven branding and premium design system | SOURCE IMPLEMENTED; VISUAL ACCEPTANCE OPEN | Semantic tokens and reusable primitives added; visual regression, rendered contrast and accessibility evidence still required |
| 06 | App shell, navigation and onboarding | SOURCE IMPROVEMENTS IMPLEMENTED; JOURNEY ACCEPTANCE OPEN | Canonical deep-link routing, explicit not-found recovery, keyboard focus, and end-to-end welcome/unlock/recovery journeys |
| 07 | Social feed, stories, comments, profiles and discovery | NOT STARTED | New/returning-user journeys, privacy and retry/idempotency tests |
| 08 | Messaging, notifications and trust | NOT STARTED | Multi-account messaging, reconnect, unread count, report/block tests |
| 09 | Marketplace and ecosystem | NOT STARTED | Buyer/seller journeys, authorization and transaction-state tests |
| 10 | Wallet, payments, rewards, membership and Pi | NOT STARTED | Server-authority, idempotency, reconciliation and Testnet evidence; no Mainnet change without explicit approval |
| 11 | Performance, accessibility and global usability | NOT STARTED | Field metrics, device/network matrix, WCAG 2.2 AA review and locale tests |
| 12 | Observability, load/recovery rehearsal and staged launch | NOT STARTED | Tested alerts, load and recovery evidence, incident owners, rollback and signed go/no-go |

## Release invariants

- Preserve GreenHaven v0.150.1 as the authoritative version baseline; do not downgrade it to match stale metadata.
- GreenHaven is the canonical user-facing brand. GH-CONNECT can remain in stable technical identifiers and compatibility contracts. Do not change the logo until the owner supplies its replacement.
- Preserve auth, database, API, storage, referral, wallet, reward, payment, and Pi contracts unless a separately reviewed migration proves compatibility.
- Never make client state authoritative for balances, entitlements, payments, or rewards.
- Do not apply migrations to production or change Mainnet settings as part of source-only work.
- Every change should be scoped, reversible, tested, and documented with before/after evidence.
- Static checks, screenshots, or a successful build alone do not prove live provider, security, load, or production behavior.

## Phase 01 work performed in this package

- Aligned package-lock root version metadata to `0.150.1`.
- Aligned `lib/app-release.ts`, current-version markers in README and project-truth documentation, and the verified manifest to `0.150.1`.
- Added a GitHub Actions CI workflow using Node.js 24.15.0 and the repository's declared verification commands.
- Added this master plan to keep the 12 phases and launch gates visible.

## Outstanding before Phase 01 can pass

- Run on supported Node.js 24.15.0 or compatible Node 24.x with registry access and install locked dependencies.
- Execute every CI job and repair failures without weakening safeguards.
- Complete typecheck, lint, production build and critical browser journeys.
- Verify the CI workflow against the actual repository host and branch protection settings.
- Confirm the exact migration inventory and target-environment migration history independently.


## Phase 02 update — durable authentication rate-limit failure policy — 2026-10-27

- Found a security downgrade in `checkDurableRateLimit`: when the durable Supabase RPC failed or was unavailable, it silently fell back to an in-process limiter. Across multiple application instances, that fallback does not provide a shared authentication abuse-control boundary.
- Added an explicit `onUnavailable: "local" | "deny"` policy. Existing callers retain the compatibility default; the Pi identity bridge opts into `deny`, returning bounded retry guidance when durable throttling cannot be confirmed.
- Added `scripts/check-phase2-durable-rate-limit-fail-closed.mjs` to protect the explicit policy, Pi auth opt-in, `Retry-After`, and blocked-event contract.
- This is source-level evidence only. The durable RPC's deployed existence, service-role grants, atomic behavior, and multi-instance behavior still require staging/live-DB operator verification. A fail-closed limiter can reduce authentication availability if the RPC is degraded; monitor and alert on this condition. No live database or production setting was changed.


## Phase 05 update — design-system consolidation — 2026-10-28

- Added semantic status tokens for success, warning, danger and info with explicit dark-theme values, shared status classes, empty-state and skeleton primitives, content gutter/width helpers, motion tokens, and reduced-motion behavior.
- Extended `lib/design-system.ts` with typed exports while retaining legacy exports and the current logo/brand asset.
- Removed one redundant `--gh-content-max` declaration without changing the established width. Safe-area/navigation contracts remain intact.
- Added `scripts/check-phase5-design-system.mjs` and `npm run check:phase5-design-system`.
- Phase 5 is source-implemented, not fully accepted: rendered contrast measurements, responsive visual regression, keyboard/screen-reader checks, and review of every user-facing route remain outstanding.
- No database, payment, reward, wallet, identity, API, migration, or live-environment changes.


## Phase 06 update — app shell, navigation and onboarding — 2026-10-28

- Canonical deep-link resolution now supports primary tabs and overlay destinations using the shared destination catalogue. Overlay events are deferred until shell listeners have mounted; URL cleanup preserves history state, unrelated query parameters, and hashes.
- Replaced delayed automatic not-found redirection with an accessible recovery screen that preserves context and offers explicit home/back actions.
- Added a Phase 6 source-contract checker and registered it in the static verification suite.
- Preserved the five-item bottom navigation, onboarding authority gate, and mounted session-lock tree. No auth, identity, economy, database, payment, reward, or Pi contract changed.
- Source acceptance checks pass; visual, browser, screen-reader, returning-user, and real device journey acceptance remains open. TypeScript/lint/build checks remain deferred until Phases 1–12 are consolidated.


## Phase 08 update — wallet and financial UX reliability sub-program — 2026-10-28

- Added strict client normalization for the server wallet snapshot, covering currency, finite/non-negative balances, category/hold fields, reconciliation metadata, and timestamps.
- Sequenced overlapping wallet refreshes to prevent older responses from overwriting newer state; transient failures preserve the last server-confirmed snapshot with an explicit stale/error state.
- Restricted Pi history and read-only payment reconciliation to Pi-provider intents denominated in PI; malformed Pi history payloads now produce a visible error instead of an empty-history state.
- Added source-contract coverage and documented remaining browser, live database, multi-user, Testnet, and Node 24 build gates. No financial writes or migrations were made.
