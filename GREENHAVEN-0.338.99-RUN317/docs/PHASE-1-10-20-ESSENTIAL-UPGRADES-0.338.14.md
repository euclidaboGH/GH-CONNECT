# Phase 1–10 — 20 Essential Upgrades (0.338.16)

**Baseline:** 0.338.16  
**Release:** 0.338.16  
**Production:** NOT APPROVED

Two essential upgrades per phase. Focus: gaps, weaknesses, missing integrity — not cosmetics.

| Phase | Upgrade A | Upgrade B | State |
|------:|-----------|-----------|-------|
| 1 Source of truth | Version identity synchronized to 0.338.16 across package, lock, app-release, manifest, PROJECT_TRUTH | Programme status remains NOT APPROVED; readiness `programmePhase` marks phase2 source-complete without claiming production | Done |
| 2 Database integrity | Proposal isolation module + closeout gate (199 unique migrations; proposals outside canonical dir) | CI never runs `supabase db push`; Phase 2 closeout report | Done |
| 3 Architecture & identity | Production Pi→GH mapping still fails closed (`IDENTITY_MAPPING_REQUIRED`) | Withdrawal/process routes remain no-store + server-authorized | Retained + gated |
| 4 Social & community | Target-ID sanitizer rejects self, demo/placeholder, control chars | Community join status maps pending vs banned distinctly | Retained + gated |
| 5 Messaging | clientMessageId bound to 80-char store contract | Full-history search rechecks membership; deleted messages excluded | Retained + gated |
| 6 GHC/PI economy | Balance integrity SQL remains **proposal only** (raw + integrity flags) | Display path keeps clamped legacy fields; GHC and PI never merged | Retained + gated |
| 7 Pi identity & withdrawals | Production rejects raw Pi UID as GH user id | Payout worker binds recipient_pi_app_uid + assertPayoutWalletAuthorization | Retained + gated |
| 8 Marketplace & membership | Commission fixed at 500 bps (no env override) | No app-only minimum fee floor vs SQL proceeds | Retained + gated |
| 9 Performance & UX | Settings export forbids expanded secret key patterns (vapid, jwt, webhook, recovery codes, …) | Shared filtering module remains the cross-surface contract | Done + retained |
| 10 Release engineering | Node 24.15.0 + typecheck/lint/build gates retained | Production NOT APPROVED; Phase 2 closeout registered in prebuild | Done |

## External blockers (unchanged)

Live PostgreSQL, Pi Testnet payments, multi-account E2E, device/a11y acceptance, Node 24 CI build on this workspace.
