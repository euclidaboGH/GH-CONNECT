# Run #301 — 20-point release-gate hardening

**Baseline:** `0.338.64`
**Date:** 2026-11-13

The current source package had a stale Phase 1–12 acceptance marker and Phase 12 release-readiness marker, plus a missing versioned upgrade worklog required by an existing request-boundary check. These were synchronized without changing product permissions, financial execution, migration application, or deployment authority.

The 20 controls and their verification are recorded in `docs/UPGRADE-WORKLOG-0.338.64.md` and enforced by `scripts/check-run301-release-gate-hardening.mjs`. The independent static suite also checks the current versioned acceptance and worklog metadata.

The documentation-hygiene gate now explicitly classifies the active Run #299, #300 and #301 engineering notes instead of misreporting them as unclassified documentation.

Production remains **NOT APPROVED**. Node.js 24.15.0 dependency-backed typecheck, lint, production build, browser/device acceptance and fresh Vercel Preview verification remain required. No live database, Pi provider or deployment operation was performed.
