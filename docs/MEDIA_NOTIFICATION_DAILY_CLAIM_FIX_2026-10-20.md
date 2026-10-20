# Media upload, notifications & daily claim — 2026-10-20

## Root cause of “device only” media errors

Vercel serverless request bodies are capped near **4.5MB**. The old client only uploaded through `POST /api/media` (proxied). Files that stayed above ~3.75MB after compress could not reach storage, so the compose UI fell back to local data URLs. Publish then correctly blocked non-durable (`blob:` / `data:`) URLs → red/blue banners.

## Fixes

1. **Direct-to-storage upload**
   - `POST /api/media/direct-upload-intent` — signed upload URL
   - Client PUT/POST to Supabase Storage
   - `POST /api/media/direct-upload-complete` — media asset record + durable `/api/media/{id}/content` URL
2. **Client** (`lib/media/upload-client.ts`): proxy for small files; direct path for larger (images ≤25MB, video ≤80MB, files ≤25MB)
3. **Compose**: does **not** attach non-durable data URLs when online; clearer errors; limits raised in UI copy
4. **Daily claim prompt**: Pi-style floating card when server `claimable`; opens Rewards; claim success still uses `notifyRewardClaimed`
5. **Notifications**: upvote/downvote/reply types mapped more clearly in the bell

## Operator requirements

- `SUPABASE_URL` + service role key
- `GH_MEDIA_BUCKET` (default `gh-media`) must allow authenticated uploads
- Storage policies must accept service-role signed uploads

## Not changed

- Ledger / GHC minting authority
- RLS ownership rules for media (owner still session-derived)
