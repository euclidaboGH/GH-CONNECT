# GreenHaven messaging presence and delivery receipts

## Required deployment order

1. Apply `migrations/20261022010105_gh_messaging_presence_delivery_receipts.sql` to **Testnet Supabase**.
2. Deploy the same branch to the Vercel **Preview** environment.
3. Test using two authenticated accounts on the same Preview deployment:
   - A sends B a message. A should see `Sent · not delivered` until B fetches the conversation.
   - B opens the conversation. A should then see `Delivered` after the next receipt refresh.
   - B keeps the conversation visible and marks it read. A should then see `Seen` after the next refresh.
   - B types in the composer. A should see `Typing…`; when B stops, the indicator should clear automatically.
   - Check online/last-seen in the chat header, then hide or close B's app and wait for the 65-second presence lease to expire.
   - Share a public post into the DM and verify the reference card survives refresh. Confirm private posts cannot be shared and follower/mutual-only posts are shared only when every recipient is allowed to view them.
   - Confirm a non-member cannot read messages or presence; confirm blocked users cannot send new DMs.
   - Set B's **Who can message you** to `No one` and verify A cannot start/send a DM. Set it to `Matches only` and verify a stranger is denied while a mutual match or reciprocal follow can message.
   - Set B's **Online status** to `Hidden` and verify A cannot see B's active/last-seen state; test `Matches only` and `Everyone` as well.
4. Review the logs and migration outcome. Apply the same migration to Mainnet only after Preview tests pass.

## Semantics and limitations

- Inbox previews and unread counts refresh about every 15 seconds while the app is visible. `Sent` means the server accepted the durable message. It does not claim that the recipient device received it.
- `Delivered` means the recipient client fetched the message through the authenticated conversation API. If the recipient is offline, delivery is naturally delayed until they reconnect and open/sync messages.
- `Seen` means the recipient's active conversation was marked read. Receipt rows and the unread cursor are updated atomically on the server. It is not proof that the recipient understood the message.
- Presence is heartbeat-based and approximate. Online leases expire after 65 seconds; typing leases expire after 8 seconds and are refreshed while the composer is active. Presence and receipts are visible only to active conversation members; direct-message presence is hidden when a block or the peer’s saved messaging privacy preference disallows the relationship.
- `Who can message you` is persisted server-side. `Matches only` allows reciprocal follows or mutual like/superlike signals; if the relationship cannot be verified, the server denies the cold DM. The server re-checks this preference on conversation creation and every send, so client-side UI cannot bypass it.
- Polling is used for compatibility with the current app architecture. This is not a push-notification service or end-to-end encryption. For high-volume real-time delivery, add an authenticated realtime transport and push notifications as a separate reviewed project.

## Vercel environment variable

Set `NEXT_PUBLIC_MESSAGING_DURABLE=true` in **Preview first**. This makes the client require durable server acceptance before treating an online send as sent, and prevents the offline queue from silently treating a local-only fallback as a successful send. Redeploy Preview after changing it. Enable it for **Production only after** the two-account security and delivery checks pass. Keep the existing environment-specific Supabase URL and service-role key separated; never expose the service-role key through a `NEXT_PUBLIC_` variable.

This upgrade adds authorization, block checks, rate limiting, server-side receipt storage, and conversation-scoped presence. It does **not** add end-to-end encryption; message content is stored in the existing Supabase message table and protected by server authorization/RLS. Do not market this as end-to-end encrypted messaging.
