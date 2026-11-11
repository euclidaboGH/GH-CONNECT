# GreenHaven 0.338.49 — Run #284 Social & Messaging Reliability

**Source baseline:** user-uploaded `GREENHAVEN-0.338.47-RUN283-ACTIVE-MODULE-UPGRADES-55-1.zip`.
**Scope:** Discovery, Matches, Connections/Follow, Direct Messages, calling, Testnet migration/source review, GitHub branch alignment, Vercel build reliability.

## Implemented in project files

1. Added a response-level Discovery privacy fallback so legacy/root-level `whoCanDiscover=no-one` and hidden/private profile settings are suppressed even if the database RPC regresses. The database RPC remains authoritative for matches-only eligibility.
2. Added `lib/server/social/match-inbox-policy.ts` to normalize profile privacy and block projection for the durable match inbox.
3. Reworked `/api/matching/inbox` to fetch outgoing/incoming signals, bidirectional block edges and counterpart privacy before returning any peer identifiers. Hidden/private/no-one profiles are suppressed; matches-only profiles require reciprocal interest; unknown privacy values fail closed. A failed or truncated privacy read returns 503 rather than a partial/unsafe inbox.
4. Fixed `createHttpMessageRepository.append` to update the local cache only. `MessagingDomain.sendMessage` already performs the canonical idempotent POST via `apiSendMessageWithRetry`; the previous repository append fired a second POST without the same `clientMessageId`, risking duplicate messages and racing the offline flusher.
5. Added focused Run #284 Discovery/match privacy and single-owner-write regression checks and registered them in `verify:static`.
6. Bumped package/release identity to 0.338.49.

## Verification completed

- Run #284 Discovery privacy fallback: 6/6 PASS.
- Run #284 match-inbox privacy tests: 10/10 PASS.
- Run #284 match-inbox wiring checks: 9/9 PASS.
- Run #284 message single-owner-write checks: 5/5 PASS.
- Run #283 active-module tests: 55/55 PASS.
- Run #283 feature wiring: 16/16 PASS.
- Run #278 communications regression: 31/31 PASS.
- Run #273 discovery/messaging/calls: 30/30 PASS.
- Run #274 DM/discovery: 20/20 PASS.
- Run #274 message search: 10/10 PASS.
- Run #275 messenger/community: 14/14 PASS.
- Run #phase 8 profile/matching: 14/14 PASS.
- Run #message hydration/media contract: 5/5 PASS.
- UI/navigation/responsive audit: 31/31 PASS.

## Connected Testnet observations

- Supabase Testnet project `tpckwgdsjlkzscjlxiwe` is ACTIVE_HEALTHY, PostgreSQL 17.11.
- Live migration history contains 39 applied entries. Exact `(version, name)` comparison finds only 10 exact source filenames in the uploaded archive and 29 missing or version-mismatched entries. The uploaded source does not contain exact sources for multiple applied migrations, including the live discovery-candidates/atomic-DM migration, the direct call-session migration, relationship privacy/block/follow serialization patches, call signaling guards, and several earlier versioned security/ACL/index repairs. Some entries have same-purpose but different version filenames. Restore exact SQL from live migration history and reconcile duplicate-version entries before any new migration or clean-database rehearsal.
- `gh_discovery_candidates` and call/match security-definer RPCs currently have EXECUTE restricted to `service_role` (anon/authenticated false).
- 13 RLS-enabled/no-policy INFO findings were reviewed. For the 5 internal financial/security tables, anon/authenticated table privileges are already false. Several social/moderation/verification tables still have SELECT grants, but RLS has no policies so ordinary clients remain denied; consider explicit SELECT revocation in a future source-backed migration after checking every API read path.
- Performance advisor reports 111 unused indexes (INFO). No indexes were dropped: usage must be assessed against workload and reset windows before removal.
- No Testnet migration was applied in Run #284. No financial, membership, message or call records were mutated.

## GitHub and Vercel

- GitHub repository `euclidaboGH/GH-CONNECT`, branch `testnet`, reports package version 0.338.31. It is behind the uploaded 0.338.47 source; do not push or patch that branch from this archive without a deliberate baseline synchronization.
- Vercel project `gh-connect-5p3o` is configured for Node 24.x. Latest deployment `dpl_52BdP4EVT5WxYGq91XZuwvSn4WtR` failed during Next.js build: worker SIGKILL / OOM, with 1.294 GB Webpack server cache pack and 4.87 GB reported input source. The Vercel dashboard build command was updated to match `vercel.json` and execute `scripts/prepare-vercel-build.mjs` before `npm run build`. No deployment was started.

## Outstanding release gates

- Reconcile exact live migration sources and the full applied history, then rehearse the dependency-ordered set against a clean disposable PostgreSQL database.
- Review and, if justified, add a versioned database function for the discovery-candidate privacy projection; the current live `gh_discovery_candidates` SQL is not present in the uploaded migrations.
- Review the remaining RLS SELECT grants for internal social/moderation tables and stage a migration only after source restoration.
- Sync GitHub from the 0.338.49 source baseline through a controlled branch/PR; do not overwrite `testnet` blindly.
- Run Node 24.15.0 dependency-backed typecheck, lint, full Next production build, and two-account browser/device acceptance.
- Validate TURN configuration and two-device audio/video calling before declaring calls production-ready.

**Source-only verification:** The Run #284 regression suite is a source-level result, not runtime acceptance. Node.js 24.15.0 is required for the dependency-backed typecheck/lint/production build; this workspace is Node 22.16.0 with no `node_modules`, so those runtime checks were not performed.

**Release status:** NOT APPROVED. Mainnet untouched.
