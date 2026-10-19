# Phase 13 — Private Media Signed Delivery (2026-10-19)

## Scope
- Adds `GET /api/media/:id/signed-url` for authenticated, owner-only access to an existing ready media asset.
- Looks up the asset by ID **and** session-derived owner ID; missing and non-owned IDs return the same 404 response.
- Rejects deleted/not-ready records and storage paths that are not rooted under the authenticated user's directory.
- Creates a five-minute Supabase Storage signed URL using the server-side service-role credential.
- Applies per-user rate limiting and `private, no-store` response headers; does not log URLs or expose credentials.
- Adds source regression tests and includes them in the release test chain.

## Integration note
This is an additive delivery endpoint. Existing upload behavior still returns a public URL and is not silently changed, because current consumers may depend on that contract. To make newly uploaded content private end-to-end, configure the `gh-media` bucket as private and update the upload/consumer contract to request signed URLs rather than treating the legacy `url` field as public. Do not expose signed URLs in durable post/profile records; they expire.

## Verification boundary
`node scripts/test-media-signed-url.mjs` validates source-level invariants. It does not replace a live Supabase Storage integration test, a role-based access test against the deployed database, TypeScript checking, lint, or production build. No migration or live project was changed.
