# GreenHaven messaging reliability upgrade — 2026-10-18

This update builds on the latest GreenHaven social/comment/story/post-composer project. It does not replace the existing messaging architecture.

## Main changes

- Server-backed per-recipient delivery and read receipts. Sender status distinguishes **Sending**, **Sent — not delivered**, **Delivered**, **Seen**, **Partly delivered** for groups, and **Not delivered** with retry.
- Server-backed online/last-seen and typing presence with expiring leases. Heartbeats run app-wide while the app is visible; active chats refresh presence about every five seconds and message history about every seven seconds.
- Server-authoritative `Who can message you` and `Online status` preferences, enforced when starting a DM and on every new DM send. `Matches only` checks reciprocal follows or mutual like/superlike signals. Unknown recipient identities, blocks, unavailable privacy data, and unconfigured legacy preferences fail closed.
- Legacy device-local privacy settings migrate to the server on each user's first authenticated app session. Until the recipient's messaging preference is synced, new DMs are temporarily denied with an explicit message instead of assuming everyone can contact them.
- One bounded unread-count RPC keeps inbox unread badges current without an N+1 message query per conversation.
- Atomic read-receipt + unread-cursor update in a server-side transaction.
- Offline retries preserve message reply references and shared-post references; permanent failures are removed from the queue and displayed as failures instead of being reported as sent.
- Sharing a post into a chat uses the canonical durable send path. The server validates the post's audience and relevant block state for every recipient before storing the post reference.
- DM creation validates the recipient identity and fails closed if block/privacy checks cannot be completed.
- Presence/receipt/preference tables deny direct client access under RLS and explicit grants; service-role-only RPCs are used for read/unread operations.
- Invalid message pagination cursors are rejected instead of reaching `toISOString()` with an invalid timestamp.

## Required deployment steps

1. Apply `supabase/migrations/202610240005_gh_messaging_presence_delivery_receipts.sql` to **Testnet Supabase** first.
2. Add `NEXT_PUBLIC_MESSAGING_DURABLE=true` to Vercel **Preview** and redeploy the Preview branch.
3. Follow `supabase/MESSAGING_PRESENCE_DEPLOY.md` with two authenticated test accounts. Test sent/delivered/seen receipts, typing, last-seen privacy, blocked users, `No one`, `Matches only`, unread badges, message replies, and sharing public/follower/mutual/private posts.
4. Enable the same variable in Production and apply the reviewed migration to Mainnet only after Preview tests pass.

Keep Mainnet and Testnet Supabase URLs/service-role keys separate. No new API secret is introduced by this update.

## Verification and limitations

- JSX safety scan: 636 files, no syntax diagnostics.
- Messaging reliability static checks: 32 passed.
- Social comments/replies/messaging checks: 15 passed.
- Engagement-roster checks: 10 passed.
- Story checks: 12 passed.
- Post-composer/feed checks: 16 passed.
- TypeScript/TSX syntax parsing: 14 changed files passed.
- A complete Next.js production build, full typecheck, ESLint and live Supabase/two-account tests are **not verified** in this working environment because dependency installation could not complete. Run them on Vercel/CI before production promotion.

This is not end-to-end encrypted messaging. Messages remain stored in the existing Supabase message table and are protected by authenticated server authorization and RLS. Delivery/presence refresh uses polling while the app is open; this update does not add WebSocket push delivery or mobile push notifications. Delivery means the recipient client fetched the message, and Seen means the conversation was marked read.
