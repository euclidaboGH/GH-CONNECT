# Live membership & messaging durability readiness (2026-10-11)

## Ten fixes applied

1. **Messages offline detection** — tracks `navigator.onLine`
2. **Reconcile on reconnect** — dispatches `ghc:messaging-reconcile` when back online
3. **Inbox durability banner** — durable flag / hybrid / offline honest states
4. **Community open → Communities filter** — `ghc:open-conversation` with `kind: community`
5. **Send failure offline copy** — restores draft; clearer toast when offline
6. **Directory `durable` signal** — from `socialListCommunities`
7. **Non-durable directory banner** — join/leave still hit live membership API
8. **Open group chat reliability** — multi-retry open after tab switch + kind/title detail
9. **Post-join flow** — cache membership, open hub, switch to My communities
10. **Documentation** of operator gates below

## Already in place (confirmed)

- `joinCommunity` → `socialJoinCommunity` (POST join, durable-aware toasts)
- `leaveCommunity` domain + local cache mirror
- `onOpenChat` → Messages tab + `ghc:open-conversation`
- MessageScreen listens for open-conversation / mark read
- `isDurableMessagingEnabled()` via `NEXT_PUBLIC_MESSAGING_DURABLE`
- Server messaging APIs under `/api/messaging/...`

## Operator gates (not claimed done here)

| Gate | Action |
|------|--------|
| Env | Set `NEXT_PUBLIC_MESSAGING_DURABLE=true` on Vercel when Supabase messaging is live |
| Supabase | Apply membership + messaging migrations; RLS verified |
| Two-user E2E | Join community, send group message, second user receives |
| Pi Browser | Messaging + communities in iframe (frame headers already Pi-safe) |
| IDOR | Re-run messaging authz suites after deploy |

## Safety

- No fabricated membership or messages
- Join success does not claim server durability when API says otherwise
- Chat history remains server/local authority via existing sendMessage path
