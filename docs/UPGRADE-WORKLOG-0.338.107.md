# GreenHaven upgrade worklog — 0.338.107

**Date:** 2026-11-19  
**Parent:** 0.338.106 configuration/component review  
**Package:** `gh-connect@0.338.107`  
**Status:** source-only release-gate wiring repair; not pushed or deployed.

## Defect addressed

The Phase 10 closure checker reported that five critical checks were not present in both the prebuild manifest and static verification suite. The repository package scripts now place these gates explicitly at the start of both suites:

1. Release hygiene
2. Project truth
3. Phase 10 release closure
4. Phase 10 platform acceptance
5. Phase 24 migration classification/review

The closure checker now parses both manifests once, verifies that each is a direct Node script invocation, separately reports malformed manifests, and validates all five required scripts in each suite. This avoids silently collapsing parser errors into five indistinguishable gate-presence failures.

## Packaging repair

Restored the safe `.env.example` template from the preceding 0.338.105 source package. It contains configuration names and safe placeholders, not live credentials. No `.env` secret file was added.

## Verification

- Phase 10 release closure: 19/19 passed.
- Release hygiene: 20/20 passed.
- Project truth: 11/11 passed.
- Phase 10 platform acceptance: 24/24 passed.
- Phase 24 final release review: passed.
- Dependency lock integrity: passed; prebuild dry-run enumerates 408 commands.
- The full 408-check prebuild was not executed in this environment; Node 24.15.0 is required.
- No database push, Supabase mutation, deployment, payment, payout, or Pi transfer was performed.
- Mainnet remains NOT APPROVED.
