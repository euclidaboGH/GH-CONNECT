# Run #278 — Communications, Discovery and Relationship Upgrade (0.338.40)

**Baseline:** `GREENHAVEN-0.338.39-RUN278-RELEASE-RESERVED-30.zip`  
**Scope:** Discovery, matches, connect, follow, direct messages, voice/video call transport, Supabase migration source integrity, and Vercel build reliability.  
**Environment:** GH Connect Testnet only. Mainnet was not changed. No Supabase migration was applied in this run.

## 30 upgrade points

### Direct calls and media transport

1. Replaced intent-only call initiation with authenticated durable call-session creation.
2. Enforced the database's `call_[32 hex]` identifier contract with cryptographically generated IDs.
3. Added a server-only call configuration endpoint; calls fail closed until explicitly enabled.
4. Added one-hour Coturn REST credentials derived by HMAC-SHA1 on the server; the shared secret is never sent to the browser.
5. Added authenticated incoming-call polling backed by the canonical incoming-call RPC.
6. Added explicit accept and decline transitions with server-derived actor identity.
7. Added cancellation and end transitions with role/state validation delegated to canonical RPCs.
8. Added bounded server routes for WebRTC offer, answer and ICE candidate exchange.
9. Added polling cursors and signal payload/volume bounds; call signals remain server-authorized.
10. Added actual `RTCPeerConnection` creation, local-track attachment, offer/answer negotiation and remote-track handling.
11. The UI reports Connected only after peer connection state is actually connected; local media alone is not success.
12. Added deterministic peer-connection close and local/remote media-track cleanup on teardown.
13. Added microphone mute and camera enable/disable controls.
14. Added distinct remote video, local camera preview and remote audio rendering.
15. Added ring and connection timeouts, network-failure states and reconnection feedback.

### Direct messaging and conversation UX

16. Preserved the complete existing DM inbox/thread layout and conversation-specific draft restoration.
17. Preserved voice-note recording with the existing bounded recording duration and playback UI.
18. Preserved owner-validated media attachments and the existing attachment count/size boundaries.
19. Preserved message reply, forward, edit/delete and reaction action contracts.
20. Preserved server-side full-history conversation search, with per-thread state and bounded query length.
21. Preserved pinned, archived and muted conversation preferences through authenticated server mutations.
22. Preserved read receipts, unread counts, delivery state and typing/presence indicators.
23. Preserved client-message idempotency and duplicate-send protection.
24. Preserved membership checks and safe user-facing errors on message read/write paths.

### Discovery, matches, connect and follow

25. Rewired Discovery to `gh_discovery_candidates`, so privacy, block, pass, follow and relationship filtering occurs in the database before profile payloads are returned; the API additionally suppresses location, interests and bio when the profile privacy settings hide them.
26. Added bounded Discovery search and stable keyset pagination using timestamp/user-ID cursors.
27. Changed Discovery rate limiting to durable, fail-closed control-plane enforcement.
28. Changed Follow writes to durable fail-closed throttling and session-derived actor identity.
29. Changed Match writes and Match inbox reads to durable fail-closed throttling; connection requests now fail closed when their durable rate-limit control is unavailable.
30. Added a 31-check Run #278 regression gate covering call transport, message preservation, Discovery privacy, social rate limiting and Vercel build cleanup.

## Supabase audit and migration status

- Testnet project `tpckwgdsjlkzscjlxiwe` was inspected read-only.
- Existing call session/signaling schema and server-side RPCs were present. Existing messages and conversations were preserved.
- Testnet currently has 142 public tables and RLS is enabled on all 142. `gh_call_sessions` and `gh_call_signals` each have deny-all client policies; all six `gh_call_*` SECURITY DEFINER RPCs have pinned `pg_catalog, public, pg_temp` search paths, deny anon/authenticated EXECUTE, and grant service_role only.
- Security advisor reports 13 RLS-enabled/no-policy INFO findings; these are existing server-only/deny-client tables, not a reason to add generic policies. Performance advisor reports 110 unused-index INFO candidates on low-traffic Testnet; no indexes were dropped because usage is not representative and some support rare/critical paths.
- Three latest call migrations were restored verbatim from `supabase_migrations.schema_migrations`: `20261111064321`, `20261111064446`, and `20261111064542`.
- Sixteen additional applied social/call migration records from 2026-11-10 remain absent from the 0.338.39 source archive. Their exact source SQL must be restored and dependency-reviewed before clean-database rehearsal or any `db push`. The missing list is recorded in `RUN278-SUPABASE-SOURCE-DRIFT-2026-11-11.md`.
- The three restored files are classified `REVIEW_REQUIRED` and marked as Testnet-applied / hold other targets. They must not be replayed against the current Testnet.
- No migration repair, bulk migration push, RLS relaxation, data rewrite, or Mainnet operation was performed.

## Vercel audit and change

- Build logs for deployment `dpl_52BdP4EVT5WxYGq91XZuwvSn4WtR` showed 2 cores / 8 GB, all 296 prebuild checks passed, then Next.js production compilation was SIGKILLed.
- Vercel's configured Build Command overrode the repository's `vercel.json` command and skipped `scripts/prepare-vercel-build.mjs`.
- The restored Webpack server-production cache contained a 1.294 GB `index.pack` plus a 1.107 GB `index.pack.old`; the build report identified OOM.
- Updated Vercel project `gh-connect-5p3o` Build Command to `node scripts/prepare-vercel-build.mjs && unset npm_config_cache_dir NPM_CONFIG_CACHE_DIR && npm run build` and retained Node `24.x`.
- This corrects the build-command mismatch; a new deployment must still confirm that cache cleanup prevents the OOM. No deployment was triggered from this local archive.

## Validation

- Run #278 communications contract: **31/31 passed**.
- Run #273 discovery/messaging/calls: **30/30 passed** after updating its old call-state assertion.
- Run #274 DM/discovery deep: **20/20 passed**.
- Priority 8 messaging: **49/49 passed**.
- In-thread search: **10/10 passed**.
- Messenger/community: **14/14 passed**.
- Phase 8 profile/matching: **14/14 passed**.
- Run #275 domain integrity: **30/30 passed**.
- Run #276 wallet UX: **12/12 passed**.
- Run #277 Pi auth/premium: **30/30 passed**.
- Run #278 release-reserved PI: **30/30 passed**.
- Run #262 build-memory source gate: **6/6 passed**.
- Run #272 feed/profile: **48/48 passed**.
- Migration source manifest: **220/220 synchronized**.
- Full Node 24 dependency-backed typecheck, lint, production build and device/two-account acceptance were not completed in this environment. The local runtime is Node 22 and `npm ci` did not complete; no claim of a successful build is made.

## Remaining release gates

1. Restore the 16 missing applied migration SQL files from the Testnet migration history and reconcile the complete source/remote version set.
2. Validate all migration files on a disposable PostgreSQL database before considering a clean install.
3. Configure `GH_CALLS_ENABLED=true`, `GH_CALL_TURN_URLS`, `GH_CALL_STUN_URLS` and `GH_CALL_TURN_SHARED_SECRET` in the Testnet Vercel environment using the actual Coturn service values. Keep calls disabled until this is done.
4. Test two authenticated Testnet accounts on different networks for incoming calls, accept/reject, voice, video, ICE recovery, hangup, blocks and timeouts.
5. Deploy the full 0.338.40 source from the authoritative archive to GitHub/Vercel; the connected GitHub Testnet branch was still behind this archive at audit time.
6. Keep Mainnet and production promotion disabled until independent approval.
