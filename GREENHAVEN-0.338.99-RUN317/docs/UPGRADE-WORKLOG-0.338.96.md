# Upgrade worklog — 0.338.96 Run 314

**Baseline:** user-designated `GREENHAVEN-0.338.93-RUN312-NOTIFICATION-RPC-FIX-2026-11-17.zip`
**Parent working derivative:** 0.338.94 full-project audit remediation
**Scope:** 30 screen-level responsive UI, layout, focus, touch and interaction refinements

## Implementation steps

1. Preserved the user-designated 0.338.93 archive as the authoritative source archive.
2. Continued from the 0.338.95 local working derivative without pushing or deploying it.
3. Added 30 numbered responsive layout and interaction rules in the shared product stylesheet.
4. Added consistent content rails and bounded scroll behavior across active modules.
5. Improved wallet balance alignment, action sizing, transaction scanning and safe-area sheet constraints.
6. Improved Pi payment recovery and withdrawal surface presentation without changing payment authority.
7. Added conversation row, message bubble and sticky composer hooks for clearer messaging layout.
8. Added a responsive community directory grid and consistent community card sizing.
9. Added a responsive marketplace listing grid and desktop purchase-panel positioning.
10. Improved feed column width, post slot containment and sticky filter presentation.
11. Improved profile timeline width and Rewards balance panel alignment.
12. Kept Membership and Settings within shared responsive reading rails.
13. Added a dedicated Run 314 source-contract gate covering all 30 rules and critical safety invariants.
14. Registered the gate in `verify:static`.
15. Synchronized package, lockfile, app release, README, project truth, acceptance fixture and worklog to 0.338.96.

## Source-only verification scope

Run 314 screen experience gate: 15/15 passed. JSX safety: 1,154 files scanned and passed. Full static verification: passed (exit code 0).

Run 314 source gate: 15/15 passed. JSX safety passed across 1,154 files. The full static verification suite is being rerun against 0.338.96; it has exposed stale release-fixture metadata that is being reconciled. Full Node.js 24.15.0 dependency installation, complete prebuild execution, TypeScript, ESLint, Next.js production build, browser/device acceptance and dependency vulnerability audit remain outstanding.

No GitHub push, Vercel deployment, Supabase mutation, migration application, wallet/payment/A2U operation or Mainnet change was performed. Production remains NOT APPROVED.
