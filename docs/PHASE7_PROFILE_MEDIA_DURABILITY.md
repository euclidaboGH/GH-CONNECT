# Phase 7 — Profile / media durability

- Server rejects blob:/data: profile photos & cover
- Client sanitizeProfileMediaPartial on update + offline flush
- Foreground profile rehydrate (60s min)
- Honest toasts when photo is device-local only
- Existing GET/PATCH /api/profile/me remains authority
