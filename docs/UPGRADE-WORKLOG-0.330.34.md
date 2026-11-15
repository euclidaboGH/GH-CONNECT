> **LEGACY VERIFICATION FIXTURE — HISTORICAL RELEASE RECORD, NOT CURRENT PROJECT AUTHORITY.**
> This worklog documents the prior 0.330.34 release only. For current implementation decisions, follow `docs/SOURCE_OF_TRUTH.md`, `docs/CURRENT_BUILD_CONTEXT.md`, and the 0.330.35 release documents.

# Upgrade worklog — 0.330.34

## Scope

Priority 8 Messages security and reliability completion increment based on the authoritative `GREENHAVEN-0.330.33-PRIORITY-8-MESSAGES-TRANSFORMATION.zip` source archive.

## Audit findings and changes

- Audited the full messaging API route set after the 0.330.33 inbox/draft/accessibility transformation.
- Found process-local rate limiting still in use for conversation creation, conversation preferences, per-conversation presence, global presence, messaging privacy preferences, community chat membership provisioning and read receipts.
- Replaced all remaining messaging API process-local rate-limit calls with the existing `checkDurableRateLimit` control-plane helper and `onUnavailable: "deny"`.
- Preserved each existing per-user quota and exposed the shared `RATE_LIMITED` / `RATE_LIMIT_UNAVAILABLE` status and `Retry-After` contract.
- Confirmed the existing `gh_security_rate_limit_consume` RPC is defined in the supplied migration set; no database migration or schema change was needed.
- Extended the dedicated Priority 8 source contract to assert durable fail-closed rate limiting across the messaging API.
- Synchronized package, lockfile, app release, README, project truth, source-of-truth context, product roadmap and documentation hygiene metadata to 0.330.34.

## Verification performed

- Priority 8 messaging transformation: 49/49.
- Legacy messaging massive-upgrade gate: 10/10.
- Phase 6 messaging inbox: 8/8.
- Message hydration/media contract: 5/5.
- Messaging bounded JSON: 28/28.
- Phase 21 private-surface durable controls: PASS (10 boundaries).
- Pass 44 durable abuse controls: PASS.
- Durable rate-limit fail-closed contract: 6/6.
- Repository consistency: 6/6.
- Messaging API process-local limiter scan: PASS (no `checkRateLimit` imports/calls remain).

## Runtime and external acceptance limitations

The workspace provides Node.js 22.16.0, while the repository requires Node.js 24.15.0 (`.nvmrc`, `package.json`). Dependencies are not installed. The runtime gate correctly rejects Node 22. Dependency-backed TypeScript, ESLint and Next.js production build have not been run. Browser, Android/Pi Browser, screen-reader, live Supabase/Testnet and operator acceptance remain outstanding. No deployment, external API mutation, database migration, payment or financial operation was performed.

## Release status

Source-level Priority 8 hardening increment only. **NOT APPROVED for production** until supported-runtime build and external acceptance gates pass.
