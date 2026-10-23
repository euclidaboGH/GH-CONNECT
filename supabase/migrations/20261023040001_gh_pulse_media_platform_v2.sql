-- Phase 35: GH Pulse + Media Platform V2.
-- Durable upload lifecycle, short-video discovery, and richer attention milestones.
-- No client-created economy value. All media ownership and visibility remain server-authoritative.

CREATE TABLE IF NOT EXISTS public.gh_media_upload_sessions (
  upload_id text PRIMARY KEY,
  owner_id text NOT NULL,
  bucket text NOT NULL,
  storage_path text NOT NULL,
  category text NOT NULL CHECK (category IN ('avatars','images','videos','audio','documents')),
  mime_type text NOT NULL,
  media_kind text NOT NULL CHECK (media_kind IN ('image','video','file')),
  expected_bytes bigint NOT NULL CHECK (expected_bytes > 0),
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','uploaded','finalized','failed','expired')),
  media_id text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 20),
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '20 minutes'),
  finalized_at timestamptz,
  CONSTRAINT gh_media_upload_owner_nonempty CHECK (length(trim(owner_id)) > 0),
  CONSTRAINT gh_media_upload_path_owned CHECK (storage_path LIKE owner_id || '/%')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_media_upload_path ON public.gh_media_upload_sessions(bucket, storage_path);
CREATE INDEX IF NOT EXISTS idx_gh_media_upload_owner_status ON public.gh_media_upload_sessions(owner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gh_media_upload_expiry ON public.gh_media_upload_sessions(expires_at) WHERE status IN ('issued','uploaded');
ALTER TABLE public.gh_media_upload_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_media_upload_sessions_no_client ON public.gh_media_upload_sessions;
CREATE POLICY gh_media_upload_sessions_no_client ON public.gh_media_upload_sessions FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_media_upload_session_create(
  p_upload_id text, p_owner_id text, p_bucket text, p_storage_path text,
  p_category text, p_mime_type text, p_media_kind text, p_expected_bytes bigint,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NULLIF(trim(p_upload_id),'') IS NULL OR NULLIF(trim(p_owner_id),'') IS NULL OR NULLIF(trim(p_storage_path),'') IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','REQUIRED_FIELDS');
  END IF;
  IF p_expected_bytes IS NULL OR p_expected_bytes <= 0 THEN
    RETURN jsonb_build_object('ok',false,'error','INVALID_SIZE');
  END IF;
  INSERT INTO public.gh_media_upload_sessions(upload_id,owner_id,bucket,storage_path,category,mime_type,media_kind,expected_bytes,metadata)
  VALUES(trim(p_upload_id),trim(p_owner_id),trim(p_bucket),trim(p_storage_path),trim(p_category),lower(trim(p_mime_type)),trim(p_media_kind),p_expected_bytes,COALESCE(p_metadata,'{}'::jsonb))
  ON CONFLICT(upload_id) DO UPDATE SET
    owner_id=EXCLUDED.owner_id, bucket=EXCLUDED.bucket, storage_path=EXCLUDED.storage_path,
    category=EXCLUDED.category, mime_type=EXCLUDED.mime_type, media_kind=EXCLUDED.media_kind,
    expected_bytes=EXCLUDED.expected_bytes, metadata=EXCLUDED.metadata,
    status=CASE WHEN public.gh_media_upload_sessions.status='finalized' THEN 'finalized' ELSE 'issued' END,
    expires_at=CASE WHEN public.gh_media_upload_sessions.status='finalized' THEN public.gh_media_upload_sessions.expires_at ELSE now()+interval '20 minutes' END;
  RETURN jsonb_build_object('ok',true,'uploadId',trim(p_upload_id),'expiresAt',(SELECT expires_at FROM public.gh_media_upload_sessions WHERE upload_id=trim(p_upload_id)));
END; $$;

CREATE OR REPLACE FUNCTION public.gh_media_upload_session_get(p_upload_id text,p_owner_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.gh_media_upload_sessions%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.gh_media_upload_sessions WHERE upload_id=trim(COALESCE(p_upload_id,'')) AND owner_id=trim(COALESCE(p_owner_id,''));
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','UPLOAD_SESSION_NOT_FOUND'); END IF;
  IF r.expires_at < now() AND r.status IN ('issued','uploaded') THEN
    UPDATE public.gh_media_upload_sessions SET status='expired',last_error='EXPIRED' WHERE upload_id=r.upload_id;
    RETURN jsonb_build_object('ok',false,'error','UPLOAD_SESSION_EXPIRED');
  END IF;
  RETURN jsonb_build_object('ok',true,'uploadId',r.upload_id,'ownerId',r.owner_id,'bucket',r.bucket,'storagePath',r.storage_path,
    'category',r.category,'mimeType',r.mime_type,'mediaKind',r.media_kind,'expectedBytes',r.expected_bytes,'status',r.status,
    'mediaId',r.media_id,'attempts',r.attempts,'expiresAt',r.expires_at);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_media_upload_session_finalize(p_upload_id text,p_owner_id text,p_media_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.gh_media_upload_sessions%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.gh_media_upload_sessions WHERE upload_id=trim(COALESCE(p_upload_id,'')) AND owner_id=trim(COALESCE(p_owner_id,'')) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','UPLOAD_SESSION_NOT_FOUND'); END IF;
  IF r.status='finalized' AND r.media_id IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'mediaId',r.media_id,'status','finalized','idempotent',true); END IF;
  IF r.expires_at < now() THEN UPDATE public.gh_media_upload_sessions SET status='expired',last_error='EXPIRED' WHERE upload_id=r.upload_id; RETURN jsonb_build_object('ok',false,'error','UPLOAD_SESSION_EXPIRED'); END IF;
  UPDATE public.gh_media_upload_sessions SET status='finalized',media_id=trim(p_media_id),finalized_at=now(),attempts=attempts+1,last_error=NULL WHERE upload_id=r.upload_id;
  RETURN jsonb_build_object('ok',true,'mediaId',trim(p_media_id),'status','finalized','idempotent',false);
END; $$;

REVOKE ALL ON FUNCTION public.gh_media_upload_session_create(text,text,text,text,text,text,text,bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_media_upload_session_create(text,text,text,text,text,text,text,bigint,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.gh_media_upload_session_get(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_media_upload_session_get(text,text) TO service_role;
REVOKE ALL ON FUNCTION public.gh_media_upload_session_finalize(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_media_upload_session_finalize(text,text,text) TO service_role;

-- Short-video feed: canonical visibility, stable keyset pagination, and explicit discovery modes.
CREATE OR REPLACE FUNCTION public.gh_short_video_list(
  p_viewer_id text,
  p_limit integer DEFAULT 12,
  p_before_ms bigint DEFAULT NULL,
  p_before_id text DEFAULT NULL,
  p_mode text DEFAULT 'latest'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_limit integer:=LEAST(GREATEST(COALESCE(p_limit,12),1),40); v_rows jsonb; v_mode text:=lower(trim(COALESCE(p_mode,'latest')));
BEGIN
  IF NULLIF(trim(p_viewer_id),'') IS NULL THEN RETURN jsonb_build_object('ok',false,'error','VIEWER_REQUIRED'); END IF;
  IF (p_before_ms IS NULL) <> (p_before_id IS NULL) THEN RETURN jsonb_build_object('ok',false,'error','INVALID_PULSE_CURSOR'); END IF;
  IF v_mode NOT IN ('latest','following','trending') THEN v_mode:='latest'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY CASE WHEN v_mode='trending' THEN q."discoveryScore" ELSE 0 END DESC,q.created_ms DESC,q.id DESC),'[]'::jsonb) INTO v_rows
  FROM (
    SELECT p.id,p.author_id AS "authorId",p.author_name AS "authorName",p.author_photo AS "authorPhoto",p.content,p.video,
      p.community_id AS "communityId",p.community_name AS "communityName",p.content_type AS "contentType",
      COALESCE(p.comment_count,0) AS "commentCount",COALESCE(p.share_count,0) AS shares,
      COALESCE(p.qualified_view_count,0) AS "qualifiedViews",COALESCE(p.view_count,0) AS views,
      (extract(epoch FROM p.created_at)*1000)::bigint AS created_ms,
      ((extract(epoch FROM p.created_at)*1000)::bigint) AS "createdAt",
      CASE WHEN v_mode='trending' THEN
        (COALESCE(p.qualified_view_count,0)*3 + COALESCE(p.share_count,0)*5 + COALESCE(p.comment_count,0)*4 + (SELECT COUNT(*) FROM public.gh_saves s WHERE s.post_id=p.id)*4)
        / GREATEST(1,EXTRACT(EPOCH FROM (now()-p.created_at))/3600.0 + 1)
      ELSE 0 END AS "discoveryScore"
    FROM public.gh_posts p
    WHERE p.deleted_at IS NULL AND p.archived_at IS NULL
      AND p.video IS NOT NULL AND trim(p.video)<>''
      AND lower(COALESCE(p.content_type,'')) IN ('short_video','reel')
      AND public.gh_post_viewer_can_read(trim(p_viewer_id),p.id)
      AND (v_mode<>'following' OR p.author_id=trim(p_viewer_id) OR EXISTS(SELECT 1 FROM public.gh_follows f WHERE f.follower_id=trim(p_viewer_id) AND f.following_id=p.author_id))
      AND (v_mode='trending' OR p_before_ms IS NULL OR (extract(epoch FROM p.created_at)*1000)::bigint<p_before_ms OR ((extract(epoch FROM p.created_at)*1000)::bigint=p_before_ms AND p.id<p_before_id))
    ORDER BY CASE WHEN v_mode='trending' THEN "discoveryScore" ELSE 0 END DESC,p.created_at DESC,p.id DESC
    LIMIT v_limit
  ) q;
  RETURN jsonb_build_object('ok',true,'posts',v_rows,'mode',v_mode,'stableCursor',v_mode<>'trending');
END; $$;
REVOKE ALL ON FUNCTION public.gh_short_video_list(text,integer,bigint,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_short_video_list(text,integer,bigint,text,text) TO service_role;

CREATE INDEX IF NOT EXISTS idx_gh_posts_short_video_feed ON public.gh_posts(created_at DESC,id DESC)
  WHERE deleted_at IS NULL AND archived_at IS NULL AND video IS NOT NULL AND content_type IN ('short_video','reel');

-- Attention milestones remain analytics only; they do not mint or transfer GHC.
-- Extend the canonical event allowlist while preserving the existing access guard.
CREATE OR REPLACE FUNCTION public.gh_content_event_record(
  p_content_id text,p_actor_id text,p_event_type text,p_window_key text,p_content_kind text DEFAULT 'post',p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_type text:=lower(trim(COALESCE(p_event_type,''))); v_kind text:=lower(trim(COALESCE(p_content_kind,'post'))); v_window text:=trim(COALESCE(p_window_key,'')); v_id text; v_inserted boolean:=false; v_author text; v_visibility text;
BEGIN
  IF NULLIF(trim(p_content_id),'') IS NULL THEN RETURN jsonb_build_object('ok',false,'error','CONTENT_REQUIRED'); END IF;
  IF NULLIF(trim(p_actor_id),'') IS NULL THEN RETURN jsonb_build_object('ok',false,'error','ACTOR_REQUIRED'); END IF;
  IF v_type NOT IN ('view','qualified_view','complete','save','share','progress_25','progress_50','progress_75') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_EVENT_TYPE'); END IF;
  IF v_kind NOT IN ('post','story','other') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_CONTENT_KIND'); END IF;
  IF length(v_window)=0 OR length(v_window)>64 THEN RETURN jsonb_build_object('ok',false,'error','INVALID_WINDOW'); END IF;
  IF v_kind='post' THEN
    SELECT author_id,visibility INTO v_author,v_visibility FROM public.gh_posts WHERE id=trim(p_content_id) AND deleted_at IS NULL;
    IF v_author IS NULL THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
    IF EXISTS(SELECT 1 FROM public.ghc_user_blocks b WHERE (b.blocker_id=trim(p_actor_id) AND b.blocked_id=v_author) OR (b.blocker_id=v_author AND b.blocked_id=trim(p_actor_id))) THEN RETURN jsonb_build_object('ok',false,'error','FORBIDDEN'); END IF;
    IF v_visibility='public' OR v_author=trim(p_actor_id) THEN NULL;
    ELSIF v_visibility='followers' THEN
      IF NOT EXISTS(SELECT 1 FROM public.gh_follows WHERE follower_id=trim(p_actor_id) AND following_id=v_author) THEN RETURN jsonb_build_object('ok',false,'error','FORBIDDEN'); END IF;
    ELSE RETURN jsonb_build_object('ok',false,'error','FORBIDDEN'); END IF;
  END IF;
  v_id:='ce_'||replace(gen_random_uuid()::text,'-','');
  INSERT INTO public.gh_content_events(id,content_id,content_kind,actor_id,event_type,window_key,metadata)
  VALUES(v_id,trim(p_content_id),v_kind,trim(p_actor_id),v_type,v_window,COALESCE(p_metadata,'{}'::jsonb))
  ON CONFLICT(content_id,actor_id,event_type,window_key) DO UPDATE SET updated_at=now(),metadata=COALESCE(EXCLUDED.metadata,public.gh_content_events.metadata)
  RETURNING (xmax=0) INTO v_inserted;
  IF v_inserted AND v_kind='post' THEN
    IF v_type='view' THEN UPDATE public.gh_posts SET view_count=view_count+1,updated_at=now() WHERE id=trim(p_content_id);
    ELSIF v_type='qualified_view' THEN UPDATE public.gh_posts SET qualified_view_count=qualified_view_count+1,updated_at=now() WHERE id=trim(p_content_id);
    END IF;
  END IF;
  RETURN jsonb_build_object('ok',true,'recorded',v_inserted,'eventType',v_type,'contentId',trim(p_content_id),'windowKey',v_window);
END; $$;
REVOKE ALL ON FUNCTION public.gh_content_event_record(text,text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gh_content_event_record(text,text,text,text,text,jsonb) TO service_role;
