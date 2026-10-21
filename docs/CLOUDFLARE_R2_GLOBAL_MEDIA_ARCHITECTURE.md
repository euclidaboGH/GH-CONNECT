# Cloudflare and R2 — global-launch architecture plan

**Status: design and migration contract only. Current uploads and delivery remain on private Supabase Storage.**

## Target responsibility split

- **Cloudflare DNS/CDN/security:** DNS, edge TLS, caching for explicitly public/static assets, WAF/rate-limit rules where available on the selected plan, and protection in front of the application. Avoid caching authenticated API responses or private media responses.
- **Vercel / Next.js:** app runtime, server authorization, session checks, signed upload-intent issuance, private viewer authorization, and provider orchestration.
- **Supabase:** identity/session data, PostgreSQL, RLS, rewards, curation, GHC ledger, media registry/metadata and authorization decisions.
- **Cloudflare R2:** private object bytes for `avatars/`, `images/`, `videos/`, `audio/`, and `documents/`. Bucket names and object keys are server-owned; never accept arbitrary client bucket/key values.

## Provider boundary required before cutover

Define a server-only `MediaStorageProvider` contract for:

1. issue short-lived upload intent for a validated object key/content type/size;
2. verify upload completion by checking object existence, size, content type and expected owner/key;
3. delete or quarantine an object;
4. issue short-lived read delivery only after the existing media registry and viewer-authorization policy succeeds;
5. return provider-neutral object identifiers and stable media IDs, not permanent public object URLs.

Keep `gh_media_assets` (or its existing canonical registry) as the app-facing source of media identity and ownership. Add a storage-provider field only after schema reconciliation; preserve existing rows and avoid hardcoding `supabase` assumptions into UI payloads. Do not move authorization into R2 bucket policy or trust an object key as proof of access.

## Migration sequence

1. Provision an R2 bucket with public access disabled and narrowly scoped API credentials; keep secrets server-side only.
2. Implement and test the provider adapter while Supabase remains the default. R2 selection must be explicit and fail closed if credentials/configuration are incomplete.
3. Test signed upload/read expiry, object overwrite protection, ownership paths, MIME/size enforcement, content-type spoofing, upload-abandon cleanup, delete behavior, private viewer access, blocked-user denial, and cache headers.
4. Add a resumable copy/backfill job with checksums and an auditable manifest. Preserve media IDs and metadata. Do not bulk-copy and switch reads in one step.
5. Shadow-verify a sample of migrated objects, then canary a small cohort, monitor errors/costs, and retain a rollback path to Supabase objects.
6. Switch new uploads only after canary success; move old objects by cohort; delete old copies only after verified retention and explicit approval.

## Security and cost controls

- Keep private media private. Do not expose the R2 S3 endpoint or permanent public URLs to clients.
- For private reads, use short-lived signed URLs or a viewer-authorized delivery endpoint. Ensure CDN caching cannot cross user/session boundaries.
- Add upload quotas, per-user rate limits, abandoned multipart cleanup, maximum object sizes, lifecycle policies, and storage/bandwidth/cost alerts.
- R2's advertised free allowance is limited (the project plan assumes 10 GB, subject to current Cloudflare pricing terms); do not design around unlimited free storage. R2 egress policy and other operation charges must be rechecked before launch.
- Store only minimal metadata in Supabase; large media bytes belong in object storage. Keep media metadata and GHC reward/curation records separate.
- Use separate credentials per environment and least privilege. Never expose R2 secrets through `NEXT_PUBLIC_*` variables.

## Acceptance gates

No production cutover until provider contract tests, signed URL expiry tests, two-user privacy tests, upload integrity checks, migration reconciliation, cost monitoring, rollback drill, and full build/typecheck/lint gates pass. This plan does not itself configure Cloudflare or migrate any media.
