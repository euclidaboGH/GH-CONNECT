-- GH-CONNECT 0.61.7 phase: durable media references and viewer-aware private delivery.
-- Additive and fail-closed. Does NOT flip the Storage bucket; run migration/backfill,
-- validate all consumers and only then switch bucket visibility in the Supabase dashboard.

CREATE TABLE IF NOT EXISTS public.gh_post_media (
  post_id text NOT NULL REFERENCES public.gh_posts(id) ON DELETE CASCADE,
  media_id text NOT NULL REFERENCES public.gh_media_assets(id) ON DELETE RESTRICT,
  role text NOT NULL DEFAULT 'attachment' CHECK (role IN ('image','video','file','thumbnail','attachment')),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0 AND sort_order <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, media_id)
);
CREATE INDEX IF NOT EXISTS idx_gh_post_media_media ON public.gh_post_media(media_id, post_id);
ALTER TABLE public.gh_post_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_post_media_no_client ON public.gh_post_media;
CREATE POLICY gh_post_media_no_client ON public.gh_post_media FOR ALL USING (false) WITH CHECK (false);

-- Attach only media owned by the author of the existing post. IDs are durable references;
-- signed URLs are deliberately never stored in post records.
CREATE OR REPLACE FUNCTION public.gh_post_media_attach(p_actor_id text, p_post_id text, p_media_ids text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_post public.gh_posts%ROWTYPE; v_count integer; v_requested integer;
BEGIN
 IF COALESCE(trim(p_actor_id),'')='' OR COALESCE(trim(p_post_id),'')='' THEN
  RETURN jsonb_build_object('ok',false,'error','INVALID_INPUT'); END IF;
 SELECT * INTO v_post FROM public.gh_posts WHERE id=trim(p_post_id) AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR v_post.author_id<>trim(p_actor_id) THEN RETURN jsonb_build_object('ok',false,'error','POST_NOT_FOUND'); END IF;
 v_requested := cardinality(COALESCE(p_media_ids,ARRAY[]::text[]));
 IF v_requested>20 THEN RETURN jsonb_build_object('ok',false,'error','TOO_MANY_MEDIA'); END IF;
 IF EXISTS (
   SELECT 1 FROM unnest(COALESCE(p_media_ids,ARRAY[]::text[])) x(id)
   LEFT JOIN public.gh_media_assets m ON m.id=x.id AND m.owner_id=trim(p_actor_id)
     AND m.status='ready' AND m.deleted_at IS NULL
   WHERE m.id IS NULL
 ) THEN RETURN jsonb_build_object('ok',false,'error','MEDIA_NOT_OWNED_OR_READY'); END IF;
 INSERT INTO public.gh_post_media(post_id,media_id,role,sort_order)
 SELECT trim(p_post_id), x.id,
        CASE WHEN m.media_kind='image' THEN 'image' WHEN m.media_kind='video' THEN 'video' ELSE 'file' END,
        x.ordinality::integer-1
 FROM unnest(COALESCE(p_media_ids,ARRAY[]::text[])) WITH ORDINALITY x(id,ordinality)
 JOIN public.gh_media_assets m ON m.id=x.id
 ON CONFLICT(post_id,media_id) DO UPDATE SET role=EXCLUDED.role,sort_order=EXCLUDED.sort_order;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN jsonb_build_object('ok',true,'postId',trim(p_post_id),'attached',v_count);
END; $$;

-- Viewer authorization is evaluated against the actual session user and the live post state.
-- Unknown/unlinked media is owner-only. Blocked users and community-bound posts fail closed
-- unless the viewer is the author; community membership authorization is not inferred here.
CREATE OR REPLACE FUNCTION public.gh_media_authorize_viewer(p_media_id text,p_viewer_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_asset public.gh_media_assets%ROWTYPE; v_allowed boolean := false; v_owner boolean := false;
BEGIN
 IF COALESCE(trim(p_media_id),'')='' OR COALESCE(trim(p_viewer_id),'')='' THEN
  RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
 SELECT * INTO v_asset FROM public.gh_media_assets WHERE id=trim(p_media_id)
  AND status='ready' AND deleted_at IS NULL;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
 v_owner := v_asset.owner_id=trim(p_viewer_id);
 IF v_owner THEN v_allowed:=true;
 ELSE
  -- Posts: same audience rules as the feed, with current block and community membership checks.
  SELECT EXISTS (
   SELECT 1 FROM public.gh_post_media pm JOIN public.gh_posts p ON p.id=pm.post_id
   WHERE pm.media_id=v_asset.id AND p.deleted_at IS NULL AND p.author_id=v_asset.owner_id
    AND NOT EXISTS (SELECT 1 FROM public.ghc_user_blocks b
      WHERE (b.blocker_id=trim(p_viewer_id) AND b.blocked_id=p.author_id)
         OR (b.blocker_id=p.author_id AND b.blocked_id=trim(p_viewer_id)))
    AND (p.community_id IS NULL OR EXISTS (SELECT 1 FROM public.gh_community_members cm
      WHERE cm.community_id=p.community_id AND cm.gh_user_id=trim(p_viewer_id) AND cm.status='active'))
    AND (p.visibility='public'
      OR (p.visibility='followers' AND EXISTS (SELECT 1 FROM public.gh_follows f WHERE f.follower_id=trim(p_viewer_id) AND f.following_id=p.author_id))
      OR (p.visibility='mutuals' AND EXISTS (SELECT 1 FROM public.gh_follows f WHERE f.follower_id=trim(p_viewer_id) AND f.following_id=p.author_id)
        AND EXISTS (SELECT 1 FROM public.gh_follows f WHERE f.follower_id=p.author_id AND f.following_id=trim(p_viewer_id))))
  ) INTO v_allowed;

  -- Stories: audience and expiry are evaluated at delivery time, not when a URL was issued.
  IF NOT v_allowed THEN
   SELECT EXISTS (SELECT 1 FROM public.gh_stories s
    WHERE s.owner_id=v_asset.owner_id AND s.status IN ('published','highlight') AND s.expires_at>now()
      AND (s.media_url=v_asset.public_url OR position('/api/media/'||v_asset.id||'/content' in COALESCE(s.media_url,''))>0)
      AND NOT EXISTS (SELECT 1 FROM public.ghc_user_blocks b
       WHERE (b.blocker_id=trim(p_viewer_id) AND b.blocked_id=s.owner_id)
          OR (b.blocker_id=s.owner_id AND b.blocked_id=trim(p_viewer_id)))
      AND (s.audience='everyone'
       OR (s.audience='followers' AND EXISTS (SELECT 1 FROM public.gh_follows f WHERE f.follower_id=trim(p_viewer_id) AND f.following_id=s.owner_id))
       OR (s.audience='friends' AND EXISTS (SELECT 1 FROM public.gh_follows f WHERE f.follower_id=trim(p_viewer_id) AND f.following_id=s.owner_id)
          AND EXISTS (SELECT 1 FROM public.gh_follows f WHERE f.follower_id=s.owner_id AND f.following_id=trim(p_viewer_id))))
   ) INTO v_allowed;
  END IF;

  -- Public profile photos are visible only when the profile record exists and neither party blocks the other.
  IF NOT v_allowed THEN
   SELECT EXISTS (SELECT 1 FROM public.gh_user_profiles up
    WHERE up.gh_user_id=v_asset.owner_id
      AND (up.photos::text LIKE '%'||COALESCE(v_asset.public_url,'__NO_LEGACY_URL__')||'%'
        OR up.cover_photo=v_asset.public_url
        OR up.photos::text LIKE '%/api/media/'||v_asset.id||'/content%'
        OR position('/api/media/'||v_asset.id||'/content' in COALESCE(up.cover_photo,''))>0)
      AND COALESCE(lower(up.profile_payload->>'visibility'),'public') NOT IN ('private','hidden')
      AND NOT EXISTS (SELECT 1 FROM public.ghc_user_blocks b
       WHERE (b.blocker_id=trim(p_viewer_id) AND b.blocked_id=up.gh_user_id)
          OR (b.blocker_id=up.gh_user_id AND b.blocked_id=trim(p_viewer_id)))
   ) INTO v_allowed;
  END IF;

  -- Messages: only current members of the conversation may read attachments sent by the asset owner.
  IF NOT v_allowed THEN
   SELECT EXISTS (SELECT 1 FROM public.gh_messages msg
    JOIN public.gh_conversation_members cm ON cm.conversation_id=msg.conversation_id
    WHERE msg.sender_id=v_asset.owner_id AND msg.deleted_at IS NULL
      AND cm.gh_user_id=trim(p_viewer_id) AND cm.left_at IS NULL
      AND (msg.meta::text LIKE '%'||COALESCE(v_asset.public_url,'__NO_LEGACY_URL__')||'%'
        OR msg.meta::text LIKE '%/api/media/'||v_asset.id||'/content%')
      AND NOT EXISTS (SELECT 1 FROM public.ghc_user_blocks b
       WHERE (b.blocker_id=trim(p_viewer_id) AND b.blocked_id=msg.sender_id)
          OR (b.blocker_id=msg.sender_id AND b.blocked_id=trim(p_viewer_id)))
   ) INTO v_allowed;
  END IF;

  -- Marketplace media is visible only while the owning listing is active.
  IF NOT v_allowed THEN
   SELECT EXISTS (SELECT 1 FROM public.gh_marketplace_listings l
    WHERE l.seller_id=v_asset.owner_id AND l.status='active'
      AND (l.metadata::text LIKE '%'||COALESCE(v_asset.public_url,'__NO_LEGACY_URL__')||'%'
        OR l.metadata::text LIKE '%/api/media/'||v_asset.id||'/content%')
      AND NOT EXISTS (SELECT 1 FROM public.ghc_user_blocks b
       WHERE (b.blocker_id=trim(p_viewer_id) AND b.blocked_id=l.seller_id)
          OR (b.blocker_id=l.seller_id AND b.blocked_id=trim(p_viewer_id)))
   ) INTO v_allowed;
  END IF;
 END IF;
 IF NOT v_allowed THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
 IF v_asset.storage_path NOT LIKE v_asset.owner_id || '/%' OR position('..' in v_asset.storage_path)>0 THEN
  RETURN jsonb_build_object('ok',false,'error','MEDIA_RECORD_INVALID'); END IF;
 RETURN jsonb_build_object('ok',true,'mediaId',v_asset.id,'ownerId',v_asset.owner_id,
   'bucket',v_asset.bucket,'storagePath',v_asset.storage_path,'mime',v_asset.mime_type,'kind',v_asset.media_kind);
END; $$;

REVOKE ALL ON FUNCTION public.gh_post_media_attach(text,text,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_post_media_attach(text,text,text[]) TO service_role;
REVOKE ALL ON FUNCTION public.gh_media_authorize_viewer(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_media_authorize_viewer(text,text) TO service_role;

-- Backfill durable references where old posts store a public URL matching the media registry.
-- This is non-destructive: legacy URLs remain in place until consumer rollout and verification.
INSERT INTO public.gh_post_media(post_id,media_id,role,sort_order)
SELECT p.id,m.id,
 CASE WHEN m.media_kind='video' THEN 'video' WHEN m.media_kind='file' THEN 'file' ELSE 'image' END,
 COALESCE(x.ord,1)::integer-1
FROM public.gh_posts p
JOIN LATERAL (
 SELECT value AS url, ordinality AS ord FROM jsonb_array_elements_text(COALESCE(p.images,'[]'::jsonb)) WITH ORDINALITY
 UNION ALL SELECT p.video, 1 WHERE p.video IS NOT NULL AND p.video<>''
 UNION ALL SELECT p.pdf, 1 WHERE p.pdf IS NOT NULL AND p.pdf<>''
) x ON true
JOIN public.gh_media_assets m ON m.public_url=x.url AND m.status='ready' AND m.deleted_at IS NULL
ON CONFLICT(post_id,media_id) DO NOTHING;

-- Rewrite known legacy public URLs to stable application references across major consumers.
-- Exact owner matching prevents one account from attaching another account's registered object.
-- Unknown/unregistered URLs are left untouched; the bucket must not be switched private until
-- the release gate confirms zero unresolved references across all application content domains.
DO $$
DECLARE r record; v_facade text;
BEGIN
 FOR r IN SELECT id,owner_id,public_url FROM public.gh_media_assets
          WHERE public_url IS NOT NULL AND length(trim(public_url))>0 AND status='ready' AND deleted_at IS NULL
 LOOP
  v_facade := '/api/media/'||r.id||'/content';
  UPDATE public.gh_posts SET
    images=replace(images::text,r.public_url,v_facade)::jsonb,
    video=CASE WHEN video=r.public_url THEN v_facade ELSE video END,
    pdf=CASE WHEN pdf=r.public_url THEN v_facade ELSE pdf END,
    author_photo=CASE WHEN author_photo=r.public_url THEN v_facade ELSE author_photo END,
    updated_at=now()
   WHERE author_id=r.owner_id AND (images::text LIKE '%'||r.public_url||'%' OR video=r.public_url OR pdf=r.public_url OR author_photo=r.public_url);

  UPDATE public.gh_stories SET
    media_url=CASE WHEN media_url=r.public_url THEN v_facade ELSE media_url END,
    owner_photo=CASE WHEN owner_photo=r.public_url THEN v_facade ELSE owner_photo END
   WHERE owner_id=r.owner_id AND (media_url=r.public_url OR owner_photo=r.public_url);

  UPDATE public.gh_user_profiles SET
    photos=replace(photos::text,r.public_url,v_facade)::jsonb,
    cover_photo=CASE WHEN cover_photo=r.public_url THEN v_facade ELSE cover_photo END,
    profile_payload=replace(profile_payload::text,r.public_url,v_facade)::jsonb,
    updated_at=now()
   WHERE gh_user_id=r.owner_id AND (photos::text LIKE '%'||r.public_url||'%' OR cover_photo=r.public_url OR profile_payload::text LIKE '%'||r.public_url||'%');

  UPDATE public.ghc_public_identities SET avatar_url=v_facade,updated_at=now()
   WHERE user_id=r.owner_id AND avatar_url=r.public_url;

  UPDATE public.gh_messages SET meta=replace(meta::text,r.public_url,v_facade)::jsonb
   WHERE sender_id=r.owner_id AND meta::text LIKE '%'||r.public_url||'%';

  UPDATE public.gh_marketplace_listings SET metadata=replace(metadata::text,r.public_url,v_facade)::jsonb,updated_at=now()
   WHERE seller_id=r.owner_id AND metadata::text LIKE '%'||r.public_url||'%';
 END LOOP;
END $$;

COMMENT ON TABLE public.gh_post_media IS 'Durable post-to-media IDs; signed URLs are ephemeral and never stored here.';
COMMENT ON FUNCTION public.gh_media_authorize_viewer(text,text) IS 'Viewer-aware private media access check. Owner access plus current post visibility; service_role only.';
