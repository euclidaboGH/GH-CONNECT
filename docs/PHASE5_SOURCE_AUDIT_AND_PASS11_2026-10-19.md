# GreenHaven Phase 5 source audit + Pass 11 (2026-10-19)

**Source of truth:** `GreenHaven-Phase-5-Provider-Integration-Gates-2026-10-19`

## Strengths already in this baseline

| Area | Status |
|------|--------|
| Social reactions/comments | Server-first + durable gates |
| Connection / follow | Server-first |
| Create/edit/archive/save post | Server-first |
| Marketplace create listing | Server-first online |
| Stories / community join | Server-first online |
| Offline queues | posts, stories, deletes, listings, messages, profile |
| Economy | Referral/curation flags OFF; GH ID transfer Phase 5 |
| Membership display | Server entitlement fail-closed |
| Privacy route | `/privacy` present |

## Weaknesses addressed in Pass 11

| Weakness | Risk | Fix |
|----------|------|-----|
| Conversation hydrate missing `online` / `conversationType` | Vercel build fail | Typed `Conversation` merge (both sites) |
| `startConversation` local-first | Cross-device invisible chats | Server-first when online; offline queue |
| Incomplete Conversation literals | Type drift / runtime gaps | `ensureConversation()` helper |
| Offline DM create no flush | Stuck local conversation ids | `offline-conversation-flush` + id remap |
| Match conversation construction | Type incompleteness | Uses `ensureConversation` |

## Remaining intentional limitations (not bugs)

| Item | Why |
|------|-----|
| Voice / media chat attachments | Text-first durable messaging |
| Comment pin | No durable RPC yet — device preference only |
| Conversation mute/archive/pin | Local UX preference |
| Referral/curation issuance | Flags OFF until Testnet evidence |
| Live multi-account proof | Operator E2E on Testnet required |

## Highest remaining external gates

1. Apply multi-user migrations on Testnet Supabase  
2. Run `npm run operator:live-e2e-social` with two session cookies  
3. Enable economy flags only after financial evidence  

## Do not claim

Mainnet readiness, live two-account PASS, or economy issuance ON.
