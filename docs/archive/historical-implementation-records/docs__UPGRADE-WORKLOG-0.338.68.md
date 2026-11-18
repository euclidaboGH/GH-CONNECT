# Run #305 — Phase 3 closeout and Phase 4 community pagination

**Release candidate:** `0.338.68`  
**Base:** user-uploaded GREENHAVEN 0.338.67 archive (SHA-256 `85297603f3e67bb67d8a4b689d63e42146f83a69a9922a744bdf753611e93a2e`).

## Twenty coordinated upgrades

1. Re-audited the Phase 3 creator-media implementation in the supplied source archive and verified the complete focused source/runtime contract set.
2. Confirmed failed photo uploads retain the original `File` for same-session retry without discarding the post draft.
3. Confirmed video and document attachment retries preserve already-ready attachments and distinguish failure type.
4. Confirmed upload cancellation is propagated through proxy, direct-upload intent, storage transfer and completion.
5. Confirmed captured identity is rechecked before media finalization and stale responses cannot cross account boundaries.
6. Confirmed composer close and account switch abort pending uploads and clear transient recovery state.
7. Confirmed draft storage is account-scoped, bounded and excludes local blob/data URLs.
8. Confirmed draft restoration preserves text, audience, community target, durable media and stable publish request metadata.
9. Confirmed media URL policy rejects unsafe schemes, protocol-relative URLs, embedded credentials and non-durable local media.
10. Confirmed image decode and video preload remain deferred, reduced-motion is respected, and the existing story-create RPC provides server-side duplicate handling for stable story IDs.
11. Repaired the missing community API `nextCursor` response by using a bounded look-ahead row.
12. Preserved the existing deterministic `(createdAt DESC, id DESC)` SQL keyset cursor semantics without adding a migration.
13. Kept community membership authorization and server-side post visibility checks in the canonical RPC path.
14. Validated the final post timestamp and ID before exposing the API cursor.
15. Kept authenticated community responses private and non-cacheable.
16. Updated the typed social client helper to forward cursor parameters and validate the returned cursor.
17. Added community-hub load-more requests using the server-issued cursor rather than client-generated offsets.
18. Merged additional pages by canonical post ID to avoid duplicate cards.
19. Fenced stale page responses, prevented concurrent load-more requests and reset pagination on community change/refresh.
20. Added accessible load-more/loading feedback, registered the new Phase 4 gate in pretypecheck/prebuild/static verification, restored the omitted fail-closed `.env.example`, and corrected a stale notification Settings assertion to test the current captured-owner guard.

## Verification evidence

- Phase 3 focused checks: **71/71**.
- Phase 4 community pagination: **12/12**.
- Phase 4 social/community boundaries: **9/9**.
- Community integrity: **53/53**.
- Social target sanitizer: **12/12**.
- Community action resilience: **9/9**.
- Phase 1 canonical post architecture: **14/14**.

## Outstanding acceptance

This remains a **source-only verification scope**. Node 24.15.0 dependency install, TypeScript, ESLint, production build, authenticated browser/mobile tests, live Supabase migration/RPC reconciliation and Vercel Preview remain outstanding. No remote deployment or production approval is claimed.
