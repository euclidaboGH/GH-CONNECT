-- Run #271 — bounded story-feed ordering and story-viewer roster indexes.
-- Applied only to GH Connect Testnet under generated history version 20261110185528.
-- Additive indexes only; no story, view, reaction, or media data is modified.

CREATE INDEX IF NOT EXISTS idx_gh_stories_active_feed_order
  ON public.gh_stories (created_at DESC, id DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_gh_story_views_story_viewed_at
  ON public.gh_story_views (story_id, viewed_at DESC, viewer_id);

COMMENT ON INDEX public.idx_gh_stories_active_feed_order IS
  'Supports deterministic newest-first active story reads; expiry remains filtered by the authoritative RPC.';
COMMENT ON INDEX public.idx_gh_story_views_story_viewed_at IS
  'Supports bounded newest-first owner story-viewer roster reads.';
