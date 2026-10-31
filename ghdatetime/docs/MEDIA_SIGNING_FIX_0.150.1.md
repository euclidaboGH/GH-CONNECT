# 0.150.1 — Media signed-URL response hardening

## Root cause
`GET /api/media/{id}/signed-url` required Supabase to return a path starting with exactly:

`/storage/v1/object/sign/`

Real Storage API responses vary by version:

- `/storage/v1/object/sign/...`
- `/object/sign/...` (missing `/storage/v1`)
- Absolute `https://{project}.supabase.co/storage/v1/object/sign/...`
- Field name `signedURL` vs `signedUrl` vs `url`

When the shape did not match, the route returned `MEDIA_SIGNING_INVALID_RESPONSE` even though Storage signed successfully. That matches “bucket reachable, auth ok, but signed URL fails.”

## Fix
- Normalize all known signed URL shapes into a trusted absolute HTTPS URL on the same Supabase origin.
- On Storage HTTP errors, return `detail` + `status` (no secrets) so operators see Object not found / JWT errors.
- Health probe: `/api/media/health?probeMediaId=media_xxx` runs a real sign through the same route.

## Operator verify (after deploy)
1. Logged in: `/api/media/media_mvqaveff_5ad752017e0247a999ab529001e3c400/signed-url`
2. Logged in: `/api/media/health?probeMediaId=media_mvqaveff_5ad752017e0247a999ab529001e3c400`
3. Expect `ok: true` and a usable `url`, or a clear `detail` string.
