# Messaging media attachments (2026-10-20)

No new tables required.

Durable DM media is stored on `gh_messages.meta.attachments` as a JSON array:

```json
[{ "id": "att_…", "type": "image"|"video"|"file", "url": "https://…", "fileName": "…", "mimeType": "…", "sizeBytes": 0 }]
```

Rules:
- Only `http(s)` URLs (never `blob:` / `data:`)
- Max 4 attachments per message
- Empty body allowed only when attachments are present (server synthesizes preview text)
- RLS unchanged — service-role writes; membership checks unchanged

Operator action: none if `gh_messages.meta` already exists (it does since 202609190001).
