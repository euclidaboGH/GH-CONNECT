# Section E + F implementation (2026-10-12)

## E — Feed / ranking / compose

| Item | Implementation |
|------|----------------|
| E27 Single host | GlobalComposeHost → PostComposer → UnifiedCompose |
| E28 Draft | Existing draft + retained |
| E29 Offline queue | `OFFLINE_COMPOSE_QUEUE_KEY` enqueue when offline |
| E30 Limits | `MAX_POST_TEXT` 4000 + counter |
| E31 Alt text | Per-image alt inputs |
| E32 Link preview | `GET /api/social/link-preview` (server, no awards) |
| E33 Poll/challenge | Share createPost pipeline; poll offline guard |
| E34 Visibility | Audience picker retained |
| E35 Impressions | Analytics only (static gate) |
| E36 Hide/show less | curation-preferences API |

## F — Graph / matches / discover

| Item | Implementation |
|------|----------------|
| F37 Like vs upvote | Feed documents post likes ≠ matching |
| F38 rejectMatch | match-screen wiring gated |
| F39 Diversity | `applyRankingDiversity` authorCap |
| F40 Search | Ignores client rank; feed mute filter |

```bash
npm run test:feed-compose-ef
```
