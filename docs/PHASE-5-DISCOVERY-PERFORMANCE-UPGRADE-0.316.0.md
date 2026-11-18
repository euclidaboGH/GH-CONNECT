# Phase 5 — Discovery performance and interaction upgrade

**Release:** 0.316.0  
**Baseline:** GH-CONNECT 0.315.9  
**Scope:** Discovery ranking and people-you-may-know interaction semantics

## Changes

- Prepare normalized interest, following, friend, location, profession, education and intent lookup data once per ranking batch instead of rebuilding relationship sets for every candidate.
- Use one captured timestamp per ranking batch for activity-recency scoring, preventing candidates from being scored against slightly different clocks.
- Suppress duplicate candidate identities in the ranking output while preserving the first source record and avoiding mutation of caller-owned candidates.
- Keep explainable reasons and the existing non-sensitive ranking signals. Wallet balances, financial activity, reports and exact coordinates are not ranking signals.
- Replace nested interactive controls in the suggested-friends row with sibling profile and Follow buttons, improving keyboard and assistive-technology behavior.

## Verification

- `scripts/test-phase5-discovery-ranking.mjs`: runtime assertions for ranking order, duplicate suppression, exclusion, explainable reasons and input immutability.
- `scripts/check-pass21-discovery-intelligence.mjs`: 9/9 passed.
- `scripts/check-pass35-settings-discovery.mjs`: 10/10 passed.
- `scripts/check-phase2-social-polish-discover-2026-11-04.mjs`: 11/11 passed.

## Release limitations

This is a source-level increment, not a production approval. Verification used Node 22.16.0 in the current workspace while the repository requires Node 24.15.0. Full TypeScript, ESLint and Next.js production-build gates were not completed. No live traffic benchmark, live recommendation-quality evaluation, Supabase migration, or production provider check was performed. The Discovery visual redesign remains a subsequent Phase 5 work item.
