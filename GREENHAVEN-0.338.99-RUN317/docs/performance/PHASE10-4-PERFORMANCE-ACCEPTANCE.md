# Phase 10.4 — Performance measurement and device acceptance

**Source baseline:** `0.330.1` (2026-11-06)
**Status:** Measurement tooling is source-present; runtime improvement is not yet demonstrated. Production remains NOT APPROVED.

## Scope

This phase establishes repeatable measurement for client JavaScript bundle size and opt-in mobile-browser smoke measurements. It is not a claim that Feed, Stories, Discovery, or Pi SDK startup has already improved.

## Measurement protocol

- Record emitted client JavaScript raw and gzip sizes, largest chunk, and top chunk contributors after a production build.
- Run the opt-in mobile Playwright smoke only against an explicitly selected local/preview/production URL using the shared resolver and production opt-in guard.
- Record response start, DOMContentLoaded, load, JavaScript transfer, LCP, CLS, and long-task count.
- Repeat runs with documented cache and network conditions; report sample counts and medians rather than selecting a best run.
- Validate the main Feed, Stories/media, Discovery, authentication, session transition, offline recovery, and account-switch journeys on actual Android devices, including Pi Browser where available.

## Acceptance boundaries

- Do not weaken Pi authentication, session validation, media authorization, visibility enforcement, or account isolation for performance.
- Compare against a captured baseline before setting or changing numeric budgets. A budget pass is not proof of faster runtime behavior.
- Preserve failures and incomplete measurements in the report; do not treat unavailable device/browser coverage as a pass.
- TypeScript, ESLint, Next.js production build, browser smoke, and physical-device acceptance must be run in their supported environments before release approval.

## Current evidence

The source includes measurement and acceptance tooling. This source archive has not established production build success, real Android/Pi Browser results, database application state, Testnet acceptance, or production readiness.
