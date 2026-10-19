# 20 essential features — Pass 12 (2026-10-19)

Implemented on Phase 5 + Pass 11 baseline. No invented balances, ledger changes, or RLS weakening.

| # | Feature | Where | Notes |
|---|---------|-------|-------|
| 1 | Skip to content | App shell | Accessibility |
| 2 | Offline banner | Global | Already present; enhanced |
| 3 | Pending offline queue chip | Offline / back-online banner | Live queue count |
| 4 | Session resume signal | Global | After 45s background → hydrate toast |
| 5 | Global hotkey `/` | Focus search | Ignores inputs |
| 6 | Global hotkey `c` | Open compose | Ignores inputs |
| 7 | Search field marker | Feed header | `data-ghc-search` |
| 8 | Copy GH ID hardened | Identity card | Clipboard + fallback |
| 9 | Copy ID button component | Shared | Reusable |
| 10 | Safe external links in posts | Enhanced post card | noopener + nofollow |
| 11 | Failed message reason | Message bubble | Shows server failureReason |
| 12 | Failed message retry | Message bubble | Existing, kept |
| 13 | Discover “Online now” filter | Discovery grid | Persisted locally |
| 14 | Discover filter persistence | essentials.ts | localStorage |
| 15 | Draft save timestamp | Compose autosave | setDraftSavedAt |
| 16 | Media retry component | Shared | No blank failed image plate |
| 17 | Relative/absolute time helpers | essentials.ts | For consistent timestamps |
| 18 | Conversation type safety | Pass 11 | ensureConversation |
| 19 | Start conversation server-first | Pass 11 | Cross-device DMs |
| 20 | Mark-all notifications | Notification bell | Already server-backed |

## Suggestions still recommended (operator / next)

- Run live two-account E2E on Testnet  
- Apply pending multi-user migrations  
- Durable comment-pin RPC when schema ready  
- Voice note upload path when messaging media API is durable  
- Native share sheet for posts on mobile  
- Image lightbox keyboard trap audit  

## Safety

- Economy issuance flags remain OFF  
- No fake balances, users, or rewards  
- Server remains authority for social/messaging when online  
