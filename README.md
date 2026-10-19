# GreenHaven (GH Connect)

## Implementation status — source baseline 0.62.2 (2026-10-19)

- Social, messaging, communities, wallet, Pi payments, and GHC ledger are implemented in source.
- GHPV (curation, active weights, settlement, calibration, soft-delete cleanup) is implemented in source. Migrations `20261013`–`20261020` are repository-only until Testnet.
- Settlement is system-only (`GH_SETTLEMENT_INTERNAL_KEY`). Votes do not mint GHC.
- Owner-only post restoration after soft-delete is implemented in source with a 30-day recovery window (migration `202610250002_gh_post_restore_owner_window.sql`); it does not restore GHPV weights or mutate GHC.
- Phase 17 adds viewer-authorized media delivery, durable post-media references, known legacy URL rewrites, provider-verified PI tip settlement into creator payables, and PI seller payout reconciliation.
- Phase 20 adds gated Pi A2U SDK orchestration and atomic funded GHC seller settlement. Phase 22 adds a gated Paystack NGN bank-beneficiary, transfer, signed-webhook and provider-reconciliation adapter. Bank payout requests require separately recorded, verified NGN obligations; the current GHC/PI marketplace rails do not create NGN liabilities, and no automatic GHC/PI-to-NGN conversion exists.
- All new provider payout features remain disabled until dependency-lock/build verification, migrations, provider Test Mode tests, database concurrency tests, and funding-source verification pass. See `PHASE_22_PAYSTACK_NGN_BANK_PAYOUTS_2026-10-19.md` and `RELEASE_GATE_PHASE22.md`.
- The private `gh-media` bucket cutover remains blocked: reconcile all legacy/unregistered URLs and verify every media-bearing consumer on Testnet before changing bucket visibility.
- Typecheck, lint, and production build could not be completed in this packaging environment because npm dependencies were unavailable from the local cache and registry access timed out. Source regression tests passed; do not treat them as a production build claim.


Human Connection OS — social connection, communities, messaging, discovery, and a separate GHC utility economy with optional Pi payments.


## Maintenance / Phase 14 (as of 2026-10-10)

| Item | Status |
|------|--------|
| Migration inventory | **70** files — `docs/MIGRATION_CHECKLIST.md` |
| Static security suites | `npm run verify:static` |
| Design tokens runtime | **`app/globals.css`** (only stylesheet; the unused `styles/globals.css` copy was removed) |
| Typecheck / production build | Operator machine — sandbox may OOM on `npm ci` |

```bash
npm ci --legacy-peer-deps
npm run verify:static
npm run audit:profile
npm run typecheck
npm run lint
NODE_OPTIONS="--max-old-space-size=6144" npm run build
```

Do **not** apply all migrations blindly. Do **not** enable durable messaging until IDOR gates pass.

## Stack

- Next.js 15 (App Router)
- TypeScript / React
- Tailwind CSS
- Supabase (ledger / economy when configured)
- Pi Network SDK (server-side approval/completion)

## Quick start

```bash
npm install --legacy-peer-deps
cp .env.example .env.local
# Fill server-only secrets in .env.local — never commit them
npm run dev
```

Production-style checks:

```bash
npm run typecheck
npm run lint
npm run build
npm run test:economy
node scripts/test-pi-payment-durable.mjs
```

## Environment

Copy `.env.example` → `.env.local`.

- **Never** commit `.env` or `.env.local`
- `PI_API_KEY` and Supabase **service role** keys are **server-only**
- Use `NEXT_PUBLIC_*` only for non-secret client config

See `.env.example` for variable names.

## Foundation readiness (release gate)

Stabilize config **before** shipping more product features.

| Endpoint | Role |
|----------|------|
| `GET /api/health/live` | Process liveness only |
| `GET /api/health` | Full readiness (Client ID, API key, Supabase durability, network mode) |
| `GET /api/payments/health` | Pi payment rail readiness |

On **Production**, `/api/health` returns **HTTP 503** when critical blockers exist (`status: "not_ready"`).

**Ship only when** Production shows `"status": "ready"` and payments health `ready: true`.

Full sandbox vs mainnet matrix and checklist: [`docs/FOUNDATION_READINESS.md`](docs/FOUNDATION_READINESS.md).

In the app: **Settings → About** shows a non-secret foundation status card.

## Product pillars

| Layer | Surfaces |
|-------|----------|
| Identity | Pi sign-in, profile, GH ID |
| Social | Feed, Discover, Messages, Matches |
| Belonging | Communities (board + member chat) |
| Value | Wallet, Rewards, Membership (GHC — not π) |

Home prioritizes one **next action**; Profile groups **Social · Value · Tools**.  
See [`docs/PRODUCT_CLARITY.md`](docs/PRODUCT_CLARITY.md).
| Marketplace | Listings; shareable to feed |

Architecture notes: `docs/SOCIAL_OS_ROADMAP.md`, `docs/HUMAN_CONNECTION_OS_COMMUNITY_ROADMAP.md`, `docs/HUMAN_CONNECTION_OS_AUDIT_60.md`

## Pi domain validation

The existing domain-validation path is `https://<your-domain>/validation-key.txt`, rewritten to `/api/validation-key`. Verify the response and the registered app's acceptance in Pi Developer Portal before promotion. The current API route returns 503 when its existing server-side validation value is missing; this source behavior is not proof that the registered domain has been accepted. Do not commit verification text or introduce an alternate validation mechanism as part of routine cleanup.

## Deploy (Vercel)

- Root directory = folder containing `package.json`
- Install: `npm ci --legacy-peer-deps` (requires the committed lockfile to be complete)
- Build: `npm run build`
- Node: `24.15.0` or later in the supported 24.x line (see `.nvmrc` and `package.json` engines)
- Configure Preview/Testnet and Production/Mainnet values separately in Vercel; never upload `.env` files or commit secrets
- Current release is not cleared for deployment until `RELEASE_GATE_PHASE25.md` passes

## Safety

- GHC ledger operations are server-authoritative
- No automatic GHC ↔ Pi conversion
- Community/social actions do not mint GHC on the client
- Demo/seed data must not appear in production paths

## License

Private / proprietary unless otherwise stated by the repository owner.


## Profile content library

The profile and peer-profile surfaces now include a searchable content library for posts, photos, videos, PDF attachments and profile-photo history. Its server-authorized query API requires the additive `20261023_gh_profile_content_library.sql` migration; apply it on Testnet and verify relationship/privacy behavior before release. See `docs/GH_MEDIA.md` for the media-storage privacy caveat and rollout steps.

See `docs/GH_PROFILE_CONTENT_LIBRARY.md` for the feature specification, authorization model, migration rollout, verification and media-storage release gate.

## Profile-connected hardening pass B (2026-10-14)

- Peer-profile preview is now mounted by the app shell and handles the shared `ghc:open-profile` event used by multiple surfaces.
- Story and media APIs have additional request bounds, URL/identifier validation, per-user rate limits, no-store responses and safer error payloads.
- Message read/edit/delete and conversation creation paths have additional rate and input bounds.
- Run `npm run audit:profile-connected-v2` as an additional static gate. This complements, but does not replace, full typecheck/lint/build and Testnet verification.


## Current audit snapshot (2026-10-19)

See `GREENHAVEN_0.61.1_AUDIT_AND_10_GAPS.md` for the source-only audit, ten material gaps, verification limits, and safe release gates. The restore migration is repository-only until its target Supabase migration history is reconciled and the migration is reviewed and applied on Testnet.

## Phase 20 payout adapters (2026-10-19)

- A2U execution uses the Pi Core Team-maintained `pi-backend@0.1.3` Node.js SDK behind explicit Testnet-only feature flags and durable global sequence serialization. Its transitive dependency graph is still missing from `package-lock.json` because registry access failed; keep the adapter disabled until the lock is refreshed and end-to-end Testnet evidence passes.
- GHC seller payout settlement uses a configured funded treasury and atomic paired ledger entries; it remains disabled by default.
- Bank/fiat seller payout requests remain rejected until a provider is selected and its beneficiary verification, credentials, webhook verification, and reconciliation are implemented.
- Review `PHASE_20_PI_A2U_AND_SELLER_PAYOUTS_2026-10-19.md`, then run `supabase/phase20_readonly_preflight.sql` before deciding whether migrations 006/007 are safe for the target project.
- Source regression: `npm run test:phase20-payout-adapters`. This does not replace TypeScript/lint/build or real Pi Testnet/SQL concurrency tests.

## Phase 21 — Premium product polish (0.62.1)

Phase 21 adds a shared cross-product design-system layer for responsive surfaces, theme-aware light/dark colors, keyboard focus, form controls, navigation, cards, dialogs, reduced-motion behavior and the recoverable error screen. It also restores mobile pinch-zoom accessibility. Existing feature flows, Pi authentication, financial authority and payment gates are preserved.

See `PHASE_21_PREMIUM_PRODUCT_POLISH_2026-10-19.md`, `RELEASE_NOTES_0.62.1.md`, and `SAFE_TO_PUSH_PHASE21.md` for exact scope and release blockers. **This is not a production-cleared build:** the `pi-backend` dependency lock graph still needs a registry-connected refresh, followed by clean install, typecheck, lint and production build. Live Pi Testnet, Supabase concurrency/migration and payout provider validation also remain outstanding.


## Phase 22 — Paystack NGN bank payout adapter (0.62.2)

Phase 22 adds server-only Paystack bank discovery and account resolution, step-up-protected beneficiary registration, privacy-preserving account fingerprints, obligation-backed payout requests, deterministic transfer references, signed webhook verification, and provider API reconciliation. It does not treat GHC or PI as NGN and does not create a payout obligation from an unsupported source. Bank transfers remain disabled by default.

Run `node scripts/test-phase22-paystack-bank-payouts.mjs` for source-level adapter checks. Review `supabase/phase22_readonly_preflight.sql`, `supabase/phase20_ghc_treasury_readonly_preflight.sql`, `supabase/tests/PHASE22_POST_MIGRATION_ASSERTIONS.sql`, and `supabase/tests/PHASE22_PAYSTACK_BANK_PAYOUT_TEST_PLAN.md` before any database operation. The `pi-backend` dependency graph still needs a registry-connected lock refresh; see `RELEASE_GATE_PHASE22.md`.


## Phase 23 — Screen-by-screen premium and Pi compliance review (0.62.3)

Phase 23 adds per-screen refinements for Feed, Discover, Profile, Messages, Communities, Marketplace, Wallet, Settings and onboarding across narrow/mobile and wider layouts; semantic screen landmarks; forced-colors support; responsive input sizing; and dynamic app-version presentation in Settings. It also hardens the official Pi SDK runtime so `Pi.init()` must succeed before U2A payment methods run, prevents duplicate SDK script injection during load races, validates Pi amount precision/memo bounds, and reserves app/engine/intent metadata keys.

Read `PI_CORE_TEAM_COMPLIANCE_REVIEW_2026-10-19.md` and `PHASE_23_SCREEN_BY_SCREEN_REVIEW_2026-10-19.md`. The Pi A2U adapter remains gated: `pi-backend@0.1.3` is published from the Pi Core Team `pi-apps/pi-nodejs` repository, but the dependency lock graph and Testnet end-to-end evidence are still outstanding before enabling. The screen review is source-based until clean install/build and real-device/Pi Browser visual checks can run.

## Phase 24 — responsive visual QA (0.62.4)

Phase 24 adds device-first layout refinements and a real-browser screenshot/overflow suite for 320, 360, 390, 768, 1024 and 1440 CSS-pixel viewports. It covers the public entry screen on every viewport and sweeps the primary tabs when a real authenticated QA session is available; it does not fabricate Pi identity, wallet balances, or successful payments. Run `npm run test:phase24-responsive-visual` for source assertions and `GHC_E2E_BASE_URL=https://<preview-host> npx playwright test --project=chromium --project=mobile-chrome` for rendered browser evidence. Review screenshot artifacts rather than treating the test alone as visual certification. See `PHASE_24_RESPONSIVE_VISUAL_QA_2026-10-19.md` and `RELEASE_GATE_PHASE24.md`.

Phase 24 remains **not cleared for production** until the real dependency lock is refreshed on a supported Node runtime, clean install/typecheck/lint/build pass, actual preview screenshots are reviewed, and the existing Pi Testnet, Supabase and payout release gates are satisfied.

## Phase 25 — repository cleanup and deployment readiness (0.62.5)

Run `npm run audit:project-integrity` before preparing a GitHub Desktop commit. It checks local imports, literal internal links, npm script targets, version alignment, Vercel build/install configuration, single-owner security headers, Git ignore rules, and generated/secret artifacts. Phase 25 removes duplicate global security headers from Next config, expands `.gitignore` to exclude common local signing-key containers, and fixes the readiness endpoint so it no longer reports the stale 0.59.4 version when `npm_package_version` is absent. **This is not a deployment clearance:** the `pi-backend@0.1.3` dependency graph is still missing from the lockfile, so the supported-runtime lock refresh, clean install, typecheck, lint, CI, build, provider tests and browser evidence remain required. See `PHASE_25_REPOSITORY_CLEANUP_AND_DEPLOYMENT_READINESS_2026-10-19.md` and `RELEASE_GATE_PHASE25.md`.


## Phase 26 — official Pi SDK lockfile recovery

The official `pi-backend@0.1.3` runtime dependency must remain installed for Pi A2U. If its lock graph is missing, do not hand-edit `package-lock.json` or remove the SDK. Use Node 24.15.0 and follow `PHASE_26_PI_BACKEND_LOCKFILE_RECOVERY_2026-10-19.md`, either regenerating the lock locally from the npm registry or manually running **Actions → Repair npm lockfile**. The workflow opens a lockfile-only PR only after the clean install and full `npm run ci:verify` pass. This workflow does not deploy or mutate production systems.
