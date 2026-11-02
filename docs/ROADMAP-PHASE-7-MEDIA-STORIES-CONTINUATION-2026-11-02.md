> Engineering note — 2026-11-02

# Phase 7 continuation — media upload recovery hardening

## Changes

- Bounded the post-Pi-session-recovery retry with the same API request timeout; previously the retry path used bare `fetch` and could hang independently of the initial request.
- Kept upload timeout failures distinguishable internally as `MEDIA_REQUEST_TIMEOUT` while returning the existing safe network message to users.
- Prevented automatic direct-storage POST replay after arbitrary PUT failures. POST fallback now occurs only when storage explicitly rejects the PUT method (`405` or `501`), avoiding a duplicate/replayed upload after ambiguous server or network outcomes.
- Preserved durable success requirements: proxy uploads require a server-confirmed media record, and direct uploads require finalization confirmation.
- Preserved authentication recovery, viewer-aware private media authorization, and non-cacheable signed URL responses.

## Validation

Run `node scripts/check-roadmap-phase7-media-stories.mjs` and the full configured `npm run verify:static` suite. These static checks do not replace the supported Node 24.15.0 TypeScript/lint/build gates or authenticated storage integration tests.

## Safety notes

No database migrations, payment code, authorization policies, or dependency versions were changed. An ambiguous upload failure is not reported as success and is not blindly replayed.
