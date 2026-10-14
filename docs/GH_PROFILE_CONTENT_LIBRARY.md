# GH-CONNECT Profile Content Library — 2026-10-14

## User-facing changes

- Adds a searchable **Content library** entry beside the owner's Posts heading and inside the collapsed Profile Dashboard.
- Adds **Browse posts, photos, videos & documents** to the peer-profile details surface.
- Provides All, Posts, Photos, Videos, Documents and Profile history views.
- Searches post body text and PDF title (`pdfName`) on the server, so users can locate older content without relying only on the current feed window.
- Loads older items in bounded pages (30 client-side; RPC caps each page at 50) using a timestamp + post-ID cursor.
- Displays document title, author attribution, description (post body), publication date, post visibility label and an Open/preview link.
- Groups profile and cover image references into Profile history. Historical profile/cover URLs are kept bounded to 24 entries per group; inline Base64 values are not duplicated into history.
- Profile/cover images upload through the existing durable media API first. Inline data URL fallback remains only when media storage is not configured, preserving existing development compatibility.

## Authorization model

`GET /api/social/profile/:userId/posts` derives the viewer from the authenticated session. It does not accept a viewer ID from the client, rate-limits requests and calls a service-role-only RPC. The RPC:

- returns only posts authored by the requested profile;
- allows the owner to view their own posts;
- allows public posts to viewers;
- allows follower-only posts only when the viewer follows the profile;
- allows mutuals-only posts when follows are mutual or an accepted connection exists (if the optional connection-request table is installed);
- excludes private posts from other users, archived posts and deleted posts;
- suppresses content in either direction when the viewer and profile have blocked each other;
- supports server-side text/PDF-title search and content-kind filters.

The optional connection-request table is checked dynamically because its migration is approval-gated in some environments. If it is absent, mutual follow relationships still work.

## Database rollout

Apply `supabase/migrations/20261023_gh_profile_content_library.sql` on Testnet before enabling the UI in a deployed environment. The migration is additive and does not change economy, rewards, membership, payment, or post-write paths. Verify that the RPC is callable by `service_role` and not by `anon` or `authenticated` directly.

Suggested post-apply checks:

```sql
select to_regprocedure('public.gh_post_list_profile_content(text,text,integer,bigint,text,text,text)');
select has_function_privilege('anon', 'public.gh_post_list_profile_content(text,text,integer,bigint,text,text,text)', 'execute') as anon_can_query_profile_content;
select has_function_privilege('service_role', 'public.gh_post_list_profile_content(text,text,integer,bigint,text,text,text)', 'execute') as service_role_can_query_profile_content;
-- Expected: function exists; anon_can_query_profile_content = false; service_role_can_query_profile_content = true.
```

## Research / security basis

OWASP recommends allow-listed file types, content/signature checks in addition to MIME checks, generated storage names, size limits, authenticated and authorized uploads, and malware/CDR scanning where available. Facebook/Meta's help materials demonstrate separate profile-photo and cover-photo albums, while noting that past photos can have their own privacy settings. The implementation follows the album/content-library pattern but intentionally avoids treating a public profile as authorization to bypass individual post visibility.

## Known release gate — object storage

The existing `/api/media` upload implementation creates public-object URLs; private/signed delivery is documented as deferred. Post visibility filtering protects the library API response but does **not** revoke a public storage URL already shared elsewhere. Therefore:

- only publish PDFs/media intended to be publicly retrievable while using a public bucket;
- do not upload confidential, embargoed, licensed-only, or otherwise restricted IP until private-bucket signed delivery and access checks are implemented across posts, stories, profile images and messages;
- obtain the rights needed to distribute books and intellectual property;
- a future IP publishing phase should add explicit license/usage terms, author/contributor metadata, copyright reporting and versioning without changing wallet/reward rules by implication.

## Verification

Static profile audit: 87/87; connected profile/media audit: 83/83; JSX safety: 613 files scanned; IDOR static: 124 passed across 112 API routes; social auth static: 31/31; Phase 14: 11/11; production safety: 21/21; production release suites: 30 passed; connection inbox regression: 32 passed; changed TypeScript/TSX syntax transpilation: 7/7.

Full dependency installation timed out in the working environment. Full project `typecheck`, ESLint and Next.js production build remain required operator gates; static checks are not a substitute for them.

## Critical Vercel upload-size gate

The current `/api/media` proxy route accepts files up to 25 MB for images, 80 MB for videos and 8 MB for PDFs, but Vercel Functions limit an individual request body to **4.5 MB**. A file-size limit in application code cannot override that platform limit. The client helper now fails fast above a conservative 4 MB file threshold rather than sending a request that will fail at the Vercel boundary. The unified and profile story composers no longer fall back to `blob:` URLs for video posts/stories because those URLs are browser-local and are not durable after publishing.

**Release blocker for large media:** implement and test a direct-to-Supabase signed upload or resumable TUS flow, then finalize/register the uploaded asset server-side before re-enabling large video/PDF selection. Supabase recommends resumable uploads for files above 6 MB and unstable networks. Until that pipeline is implemented, the UI should explain that large-file upload is not enabled; do not claim 25–80 MB uploads work on Vercel. See [Vercel Function limits](https://vercel.com/docs/functions/limitations), [Vercel's payload-too-large guidance](https://vercel.com/docs/errors/function_payload_too_large), and [Supabase resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads).

## Connected-systems hardening pass B (2026-10-14)

- The peer profile overlay is now mounted by the app shell and listens to the existing `ghc:open-profile` event, covering discovery and other UI entry points that emit that event. If a requested user is not present in the current authenticated discovery candidate set, the app fails visibly and navigates to Discover instead of showing fabricated profile data.
- The profile preview no longer shows an unexplained synthetic compatibility percentage. Follow, message, like/pass, block and report actions are wired to the existing context actions; unsupported Mute is hidden when no handler is provided.
- The Posts tab represents the full timeline, including media-bearing posts. Photos, Videos and Documents remain specialized views.
- Story reads/writes are rate-limited, bounded, URL-validated and non-cacheable. Story IDs and display names are server-derived; failed durable story reads return an explicit unavailable response.
- Media resolution is rate-limited, validates identifiers and suppresses upstream storage error details. The alternate media pipeline now shares the 4 MB preflight limit to avoid Vercel's 4.5 MB function request cap.
- Message reads, edits and deletes now have per-user rate limits and stricter identifier/body validation. Conversation creation is rate-limited and its JSON request size is bounded.

These are static/source-level safeguards. Verify behavior on Testnet with multiple accounts, including blocked users, and run a complete dependency install, typecheck, lint and Next.js build before deployment.
