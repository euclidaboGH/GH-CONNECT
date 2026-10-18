# GreenHaven offline queue matrix

Updated: 2026-10-18 (Massive Pass 10)

| Queue type | Enqueue when | Flush module | Cross-account when durable |
|------------|--------------|--------------|----------------------------|
| `send_message` | Offline message | `lib/messaging/offline-message-flush.ts` | Yes |
| `profile_update` | Offline / failed persist | context online effect | Yes |
| `create_post` | Offline post | `lib/social/offline-post-flush.ts` | Yes |
| `create_story` | Offline story | `lib/social/offline-story-flush.ts` | Yes |
| `delete_post` | Offline delete | `lib/social/offline-delete-flush.ts` | Yes |
| `create_listing` | Offline marketplace sell | `lib/social/offline-listing-flush.ts` | Yes |

Unified helper: `lib/offline/flush-all.ts` (`flushAllOfflineQueues`).

Device-local only (not queued for multi-user): conversation mute/archive pin, voice notes, media attachments in chat, comment pin preference.

Economy issuance flags remain OFF until operator Testnet evidence.
