# GH-CONNECT Roadmap Phase 3 — Messaging & Communication

Date: 2026-11-02

## Confirmed defects addressed

- The `ghc:messaging-reconcile` handler cleared the message composer on online/realtime reconciliation. Reconciliation is not proof that a draft was sent; the handler now refreshes the message window/read marker without mutating the draft.
- Opening a different thread removed the draft key for the previously selected conversation. That destructive removal is gone; drafts remain keyed by conversation and the selected-thread hydration restores the correct one.

## Regression coverage

`node scripts/check-roadmap-phase3-messaging.mjs` asserts draft preservation across reconnects/thread changes, per-conversation draft restore/persistence, non-fatal storage failures, and failed-send draft restoration. The check is registered in `prebuild` and `verify:static` and can be run directly with `npm run check:roadmap-phase3-messaging`.

## Scope and safety

This phase is an additive, focused resilience patch over the Phase 2 project tree. It does not alter message authorization, RLS, server-side identity, rate limits, durable-write semantics, notification RPC privileges, migrations, payment flows, or dependency versions. No migration needs to be applied.

## Verification limits

Static regression checks do not prove delivery across live devices or a deployed Supabase project. Full `npm run verify:static`, TypeScript, lint, production build, live realtime, and Pi Browser tests must be run in the supported Node 24.15.0 environment with project dependencies and credentials. They are not claimed as passed here.
