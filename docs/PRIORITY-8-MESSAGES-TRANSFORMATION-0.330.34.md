# Priority 8 — Messages transformation (0.330.34)

This increment begins the coordinated Messages transformation on the existing authenticated messaging foundation. It does not replace conversation storage, session identity, membership authorization, idempotent writes, owned-media validation, presence, read receipts, or the durable abuse-control plane.

## Product and interaction changes

- Added a dedicated Archived inbox lane with an explicit count and empty state. Active lanes exclude archived conversations; the archive lane shows only the viewer's archived conversations. Pin, archive/restore and mute/unmute now call the authenticated per-member preference endpoint, and server inbox hydration returns the saved viewer-specific values across sessions/devices.
- Corrected draft lifecycle handling. Drafts remain conversation-scoped and are no longer cleared when the user leaves Messages, closes a thread, switches conversations, or reconnects. The existing persistence effect removes the current thread's draft only when its composer is empty after a successful send flow.
- Conversation actions are visible on touch layouts and available through keyboard focus on larger layouts; pin/archive/mute actions have contextual accessible names and touch-friendly targets.
- Message action controls remain visible on touch and focus-reachable on desktop. Message bubbles use group semantics rather than exposing a non-activatable button role.
- Composer enforces the server's 8,000-character text limit and exposes a character count associated with the textarea.
- Emoji insertion controls have explicit button types and accessible names.

## Existing foundations retained

- Server-derived identity and active conversation membership checks.
- Durable message persistence in production; no process-memory fallback as production authority.
- All nine messaging abuse-control buckets now use the shared durable rate-limit control plane: conversation creation, inbox preference writes, conversation presence reads/writes, global presence heartbeats, messaging privacy preference reads/writes, community membership provisioning and read receipts with `onUnavailable: "deny"`; serverless instances no longer rely on per-process memory limits for these messaging entry points.
- Client-message idempotency, bounded request bodies and durable fail-closed send/read abuse controls.
- First-party owned media authorization; arbitrary user-supplied URLs are not accepted as durable message attachments.
- Server-side privacy, reciprocal block, read receipt, presence and personal conversation preference boundaries.
- Existing offline queue/reconciliation and message delivery states.

## Verification and release status

The dedicated `check-priority8-messaging-transformation.mjs` gate is registered in both `prebuild` and `verify:static`. Existing messaging inbox, media hydration, bounded JSON, private-surface durable-control, accessibility-navigation and repository-consistency checks are also retained.

This is a source-level increment. The supplied workspace runtime is Node 22.16.0 while the repository requires Node 24.15.0 (`.nvmrc`, `package.json`), and dependencies are not installed in this workspace. Dependency-backed typecheck, ESLint, Next.js production build, browser/Android/Pi Browser and screen-reader acceptance, plus live Supabase/Testnet messaging acceptance have not been completed here. The durable rate-limit RPC is already defined in the existing security-control-plane migrations; no database migration is added or applied in this increment. Production approval remains blocked on those external acceptance gates.


## 0.330.34 hardening audit and changes

The 0.330.33 Priority 8 static gate passed 41/41 checks. A focused route audit then found four messaging entry points still using process-local `checkRateLimit`: direct-conversation creation, conversation preference writes, per-conversation presence, and global presence heartbeat. Process-local counters are not shared across serverless instances and therefore do not provide a reliable production abuse-control boundary.

This increment replaces all remaining messaging API process-local limiters with `checkDurableRateLimit` from the existing security control plane and configures `onUnavailable: "deny"`. Exhausted quotas return 429; unavailable durable control-plane responses are mapped through the shared status/code helpers (503), with `Retry-After` retained. Existing limits are preserved (20 conversation creates/minute, 30 inbox preference writes/minute, 120 per-conversation presence reads/minute, 120 per-conversation presence writes/minute, 60 global presence heartbeats/minute, 60 messaging privacy preference reads/minute, 20 messaging privacy preference writes/minute, 40 community membership provisioning requests/minute, and 120 read receipts/minute). No schema or migration changes are required because `gh_security_rate_limit_consume` already exists in the supplied migration set.

The dedicated static gate now verifies every messaging API rate-limit bucket remains on the durable fail-closed path. A repository scan confirms no `checkRateLimit` imports or calls remain under `app/api/messaging`. This is a source-level hardening completion, not a claim of live database, browser, device or production acceptance.
