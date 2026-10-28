# GreenHaven Phase 1–12 System-Wide Acceptance and Remediation

## Release snapshot

- Current source baseline for this consolidated report: `0.157.16` (2026-10-28). Historical implementation notes below retain their original release labels; they are not the current project version.
- Scope: consolidation and source-level acceptance across Phases 1–12, plus the later source checks already present in this repository.
- The canonical project root is the repository root. The stale nested `greenhaven-upgrade-next/` copy was removed because it was pinned to `0.150.1` and duplicated the project tree; its only nested-only path was an empty directory.

## Current audit status (v0.157.16)

- The v0.157.0 uploaded baseline passed the network/database-independent static suite: 43/43 checks.
- The v0.157.1 patch synchronized release-truth metadata. The v0.157.2 patch strengthens Phase 3 public identity hydration with bounded nested comment/reply traversal and safe avatar fallback validation. The v0.157.3 patch hardens restore-evidence reads against symlink/path-swap races and expands Phase 4 recovery/identity regression contracts. The v0.157.4 patch centralizes approved brand asset paths, guards logo files with SHA-256 checks, and strengthens safe-area and high-contrast UI behavior. The v0.157.5 patch hardens browser navigation runtime guards, validates settings-section payloads, rejects control characters in navigation strings, and provides a Home fallback for direct-entry not-found recovery. The v0.157.6 patch fails closed when feed posts lack canonical author identifiers, preventing malformed feed rows from bypassing mute enforcement, and adds the Phase 7 social contract to consolidated static verification. The v0.157.7 patch strengthens wallet snapshot validation and no-store responses. The v0.157.8 Phase 9 increment tightens Pi transaction projection and payment-intent input validation while preserving read-only, user-scoped reconciliation. The v0.157.9 Phase 10 increment adds streaming body bounds to marketplace order creation, payment, transition and commerce mutations; strict quantity validation; bounded listing identifiers; non-coercive commerce payload handling; and no-store mutation responses. The v0.157.10 follow-up prevents generic public transitions from asserting refunds or commerce lifecycle outcomes, and requires durable seller delivery/service activation before buyer confirmation. The v0.157.11 Phase 11 increment validates marketplace intent/order identifiers, amount and rail agreement, refund/cancellation terminal-state consistency, avoids reusable membership-reference false matches, and centralizes the payment-intent history cap.
- The v0.157.12 Phase 12 increment repairs the consolidated static runner registration for the audit-UX check, adds a stronger release gate for migration inventory/classification drift and duplicate migration prefixes, and synchronizes current release truth across documentation and artifacts. This remains source-only evidence.
- The v0.157.13 cross-phase hardening increment applied streaming byte limits to seven previously unbounded JSON write routes across account lifecycle, social, notifications, communities, and marketplace features.
- The v0.157.14 follow-up adds streaming byte limits to twelve further high-impact financial, identity, and social write routes, tightens payout amount type validation, and makes social follow target identifiers string-only. The v0.157.16 follow-up extends this to connection requests, reports, matching signals, creator tips, and bank-beneficiary mutations, with runtime tests for the bounded JSON parser. These are source-level safeguards and isolated helper tests, not full application or live-system acceptance.
- The available audit container runs Node.js 22.16.0, while the project requires Node.js 24.15.0; `node_modules` is absent. TypeScript, lint, production build and browser E2E have therefore not been run here.
- The repository contains 140 migration files (98 REQUIRED, 1 REQUIRES_APPROVAL, 2 PROPOSAL, 39 REVIEW_REQUIRED). This is a source inventory only; each target's remote migration history must be reconciled independently.
- No live Supabase/Pi/Vercel operation, database migration, restore drill, or financial mutation was performed.

## Improvements made

1. Removed the stale duplicate project tree to prevent engineers from editing or packaging an obsolete source version by mistake.
2. Added `scripts/check-phase1-12-consolidation.mjs` and registered it in the npm scripts and consolidated static suite.
3. Strengthened version consistency across `package.json`, `package-lock.json`, `lib/app-release.ts`, and `VERIFIED_MANIFEST.txt`.
4. Preserved explicit boundaries between source-level checks and operational acceptance.
5. Retained all existing network-independent source checks and did not change production data, financial records, or database migration state.

## Verification performed

- `node scripts/verify-phase14-static.mjs` — passed before the consolidation changes; rerun after changes is required and recorded in the delivery summary.
- Phase 1–12 consolidation contract — checks version consistency, required phase reports, static-suite registration, stale-tree absence, runtime pin, and honest acceptance wording.
- ZIP integrity — must be checked on the final archive.

## Outstanding release acceptance

Source checks do not prove that GreenHaven builds, deploys, or behaves correctly against live infrastructure. The environment used for this review exposes Node.js 22.16.0 while `.nvmrc` pins Node.js 24.15.0; `node_modules` is not present. Consequently TypeScript, lint, production build, browser E2E, and real PostgreSQL/Testnet operator drills cannot be honestly claimed as complete in this environment.

Before deployment, use Node.js 24.15.0, install strictly from the lockfile, run typecheck/lint/build and browser journeys, reconcile migration history against a disposable database, test wallet/payment/order idempotency and recovery, and attach real operator evidence. Do not apply migrations or mutate production financial data as part of a source audit.


## Historical v0.152.0 hardening delta (superseded by subsequent releases)

- Added a finite timeout to public profile identity hydration and rejected protocol-relative, backslash-containing, and control-character photo URLs.
- Bounded navigation destinations and externally sourced navigation event payloads.
- Rejected malformed supplied Pi transaction amounts rather than silently omitting invalid values.
- Expanded Phase 3, Phase 6, and Phase 9 regression checks.
- The network/DB-independent static suite was rerun on this source tree: 35/35 checks passed.
- Runtime TypeScript/lint/build, browser journeys, and operational database/Testnet checks remain separate acceptance requirements.
