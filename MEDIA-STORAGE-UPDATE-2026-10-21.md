# GH-CONNECT Media Storage Update — 2026-10-21

## Supabase bucket contract

- Bucket: `gh-media`
- Visibility: private (`public = false`)
- Global object-size cap: 50 MiB
- Category folders (exact names): `audio/`, `documents/`, `avatars/`, `images/`, `videos/`
- New object path format: `{category}/{authenticatedUserId}/{randomFileName}`

## Allowed MIME types

The application allowlists match the user's Supabase configuration:

- Images: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif`
- Videos: `video/mp4`, `video/webm`, `video/quicktime`
- Audio: `audio/mpeg`, `audio/mp4`, `audio/aac`, `audio/ogg`, `audio/wav`, `audio/webm`, `audio/flac`
- Documents: `application/pdf`

No `application/x-pdf` alias is accepted by these upload routes because it is not in the configured Supabase allowlist.

## Application limits

- Images/avatars: 25 MiB
- Videos: 40 MiB
- Audio: 25 MiB
- PDF documents: 25 MiB

The Supabase 50 MiB global limit is a separate cap and does not replace per-category server validation.

## Privacy and authorization

- Existing bucket is not modified by editing this source ZIP; verify the existing `gh-media` settings in Supabase separately.
- Keep the bucket private and do not add broad public Storage policies.
- Preserve the media registry and viewer-authorized media delivery/signed URL flow.
- Direct-upload completion checks the root category, authenticated owner's path segment, MIME type, category limit and declared size.

## Verification performed

Passed local source-level checks:

- `node scripts/test-media-direct-upload.mjs`
- `node scripts/test-media-route-hardening.mjs`
- `node scripts/test-media-signed-url.mjs`
- `node scripts/audit-private-media-consumers.mjs`

Not run: full TypeScript check, production build, or live Supabase upload/privacy tests. Dependencies are not installed in this working environment. Complete those gates on Testnet before deploying.
