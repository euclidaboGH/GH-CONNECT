# Messaging section audit (2026-10-11)

## Canonical surface

| Module | Role |
|--------|------|
| `MessageScreen` | **Active** Messages tab (inbox + thread) |
| `message-components` | Bubbles, input, list items, header |
| `messages-screen.tsx` | Re-export only |
| `chat-screen.tsx` | **Deprecated** legacy empty shell |
| `enhanced-group-message.tsx` | **Deprecated** unused bubble |

## Fixes this pass

1. Wire **reply** via `replyToMessage` domain path  
2. Wire **delete** via `deleteMessage`  
3. **Retry** failed messages (restore text to composer)  
4. **Copy** to clipboard with status  
5. Reply chrome + cancel  
6. Muted conversation notice  
7. Clear reply state on open/close thread  
8. Honest attachment gate (toast, no fake upload)  
9. Emoji owned by MessageInput (no false “unavailable” toast)  
10. Search clear a11y  

Prior: offline/durable banners, Escape, filter keyboard, composer disable offline, `role="log"`.

## Safety

- No fabricated messages  
- Attachments not enabled without media storage  
- Offline send still domain-controlled (`offline` flag in sendMessage)  
