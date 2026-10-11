# Communities / group chat audit (2026-10-11)

## Architecture (canonical)

| Surface | Component | Role |
|---------|-----------|------|
| Directory | `CommunitiesScreen` | My / Discover list, join, create |
| Hub | `PremiumCommunityHub` | Board, announcements, events, chat **entry** |
| Full group chat | Messages tab (`onOpenChat`) | Real message history & send |
| Legacy bubble | `EnhancedGroupMessage` | **Deprecated**, unused |

## Fixes this pass

1. Brand tokens (`--gh-green`) across hub/directory/cards  
2. Teal chat chrome → emerald design language  
3. Chat tab: clear **Open group chat** empty/entry (no fake threads)  
4. Mute control attempts durable `onMute` when provided  
5. Hub keyboard nav (prior) + directory loading/error/offline (prior)  
6. Mark `EnhancedGroupMessage` deprecated  

## Intentional product boundary

- **Board** = structured community content  
- **Chat tab in hub** = member gate + tools + open full thread  
- **Messages** = durable group conversation UI  
- Do not invent chat history in the hub  

## Safety

- Directory from `socialListCommunities` only  
- Join/leave/create use existing domain handlers  
- No fabricated members or messages  
