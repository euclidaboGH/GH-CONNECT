-- GREENHAVEN PHASE 33 — Community Platform V2
-- Durable community governance, announcements, events, RSVPs, resources and reports.
-- Server-authoritative; no GHC/Pi/ledger mutation.

CREATE TABLE IF NOT EXISTS public.gh_community_moderation_log (
  id text PRIMARY KEY,
  community_id text NOT NULL REFERENCES public.gh_communities(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('pin','unpin','hide','unhide','report','lifecycle','role_change','remove_member','ban_member','unban_member','announcement','event','resource')),
  target_type text NOT NULL CHECK (target_type IN ('post','member','community','report','announcement','event','resource')),
  target_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gh_community_modlog_community_created ON public.gh_community_moderation_log(community_id, created_at DESC);
ALTER TABLE public.gh_community_moderation_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_community_moderation_log_no_client ON public.gh_community_moderation_log;
CREATE POLICY gh_community_moderation_log_no_client ON public.gh_community_moderation_log FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_community_reports (
  id text PRIMARY KEY,
  community_id text NOT NULL REFERENCES public.gh_communities(id) ON DELETE CASCADE,
  reporter_id text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('community','post','member','event','resource')),
  target_id text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('spam','harassment','hate','misinformation','impersonation','safety','other')),
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  resolution_note text NOT NULL DEFAULT '',
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gh_community_reports_queue ON public.gh_community_reports(community_id,status,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_community_report_dedupe ON public.gh_community_reports(community_id,reporter_id,target_type,target_id,reason) WHERE status IN ('open','reviewing');
ALTER TABLE public.gh_community_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_community_reports_no_client ON public.gh_community_reports;
CREATE POLICY gh_community_reports_no_client ON public.gh_community_reports FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_community_announcements (
  id text PRIMARY KEY,
  community_id text NOT NULL REFERENCES public.gh_communities(id) ON DELETE CASCADE,
  author_id text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  announcement_type text NOT NULL DEFAULT 'info' CHECK (announcement_type IN ('info','important','celebration','maintenance')),
  pinned boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gh_community_announcements_feed ON public.gh_community_announcements(community_id,pinned DESC,created_at DESC);
ALTER TABLE public.gh_community_announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_community_announcements_no_client ON public.gh_community_announcements;
CREATE POLICY gh_community_announcements_no_client ON public.gh_community_announcements FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_community_events (
  id text PRIMARY KEY,
  community_id text NOT NULL REFERENCES public.gh_communities(id) ON DELETE CASCADE,
  creator_id text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','ongoing','ended','cancelled')),
  location text,
  virtual_link text,
  category text NOT NULL DEFAULT 'meeting' CHECK (category IN ('meeting','social','workshop','discussion','celebration')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_gh_community_events_upcoming ON public.gh_community_events(community_id,starts_at ASC);
ALTER TABLE public.gh_community_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_community_events_no_client ON public.gh_community_events;
CREATE POLICY gh_community_events_no_client ON public.gh_community_events FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_community_event_rsvps (
  event_id text NOT NULL REFERENCES public.gh_community_events(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  status text NOT NULL DEFAULT 'going' CHECK (status IN ('going','maybe','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(event_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_gh_community_event_rsvps_user ON public.gh_community_event_rsvps(user_id,event_id);
ALTER TABLE public.gh_community_event_rsvps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_community_event_rsvps_no_client ON public.gh_community_event_rsvps;
CREATE POLICY gh_community_event_rsvps_no_client ON public.gh_community_event_rsvps FOR ALL USING(false) WITH CHECK(false);

CREATE TABLE IF NOT EXISTS public.gh_community_resources (
  id text PRIMARY KEY,
  community_id text NOT NULL REFERENCES public.gh_communities(id) ON DELETE CASCADE,
  uploaded_by text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  resource_type text NOT NULL DEFAULT 'link' CHECK (resource_type IN ('document','link','guide','template','media')),
  url text,
  content text,
  sort_order integer NOT NULL DEFAULT 0,
  pinned boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (url IS NOT NULL OR content IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_gh_community_resources_order ON public.gh_community_resources(community_id,pinned DESC,sort_order ASC,created_at DESC);
ALTER TABLE public.gh_community_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_community_resources_no_client ON public.gh_community_resources;
CREATE POLICY gh_community_resources_no_client ON public.gh_community_resources FOR ALL USING(false) WITH CHECK(false);

CREATE OR REPLACE FUNCTION public.gh_community_platform_role(p_community_id text,p_user_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r text; s text;
BEGIN
  SELECT role,status INTO r,s FROM public.gh_community_members WHERE community_id=p_community_id AND gh_user_id=p_user_id;
  IF NOT FOUND OR s <> 'active' THEN RETURN NULL; END IF;
  RETURN r;
END; $$;

CREATE OR REPLACE FUNCTION public.gh_community_platform_get(p_community_id text,p_viewer_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.gh_communities%ROWTYPE; v_role text; v_status text; v_json jsonb;
BEGIN
  SELECT * INTO c FROM public.gh_communities WHERE id=trim(p_community_id) AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  SELECT role,status INTO v_role,v_status FROM public.gh_community_members WHERE community_id=c.id AND gh_user_id=trim(p_viewer_id);
  IF c.privacy <> 'public' AND (v_status IS DISTINCT FROM 'active') AND c.created_by <> trim(p_viewer_id) THEN
    RETURN jsonb_build_object('ok',false,'error','FORBIDDEN');
  END IF;
  SELECT jsonb_build_object(
    'id',c.id,'name',c.name,'purpose',c.purpose,'description',c.description,'category',c.category,'privacy',c.privacy,
    'createdBy',c.created_by,'coverImage',c.cover_image,'rules',c.rules,'tags',c.tags,'welcomeMessage',c.welcome_message,
    'memberCount',c.member_count,'role',v_role,'membershipStatus',v_status,
    'announcements',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'communityId',a.community_id,'authorId',a.author_id,'title',a.title,'content',a.content,'type',a.announcement_type,'pinned',a.pinned,'expiresAt',extract(epoch FROM a.expires_at)*1000,'createdAt',extract(epoch FROM a.created_at)*1000,'updatedAt',extract(epoch FROM a.updated_at)*1000) ORDER BY a.pinned DESC,a.created_at DESC) FROM public.gh_community_announcements a WHERE a.community_id=c.id AND (a.expires_at IS NULL OR a.expires_at>now())), '[]'::jsonb),
    'events',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'groupId',e.community_id,'creatorId',e.creator_id,'title',e.title,'description',e.description,'startsAt',extract(epoch FROM e.starts_at)*1000,'endsAt',extract(epoch FROM e.ends_at)*1000,'status',e.status,'location',e.location,'virtualLink',e.virtual_link,'category',e.category,'attendees',COALESCE((SELECT jsonb_agg(r.user_id) FROM public.gh_community_event_rsvps r WHERE r.event_id=e.id AND r.status='going'),'[]'::jsonb),'rsvpStatus',(SELECT r2.status FROM public.gh_community_event_rsvps r2 WHERE r2.event_id=e.id AND r2.user_id=trim(p_viewer_id))) ORDER BY e.starts_at ASC) FROM public.gh_community_events e WHERE e.community_id=c.id AND e.status<>'cancelled'), '[]'::jsonb),
    'resources',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'groupId',r.community_id,'title',r.title,'description',r.description,'resourceType',r.resource_type,'url',r.url,'content',r.content,'uploadedBy',r.uploaded_by,'uploadedAt',extract(epoch FROM r.created_at)*1000,'order',r.sort_order,'pinned',r.pinned) ORDER BY r.pinned DESC,r.sort_order ASC,r.created_at DESC) FROM public.gh_community_resources r WHERE r.community_id=c.id),'[]'::jsonb),
    'pendingJoinRequests',CASE WHEN v_role IN ('owner','admin','moderator') THEN COALESCE((SELECT jsonb_agg(m.gh_user_id ORDER BY m.joined_at ASC) FROM public.gh_community_members m WHERE m.community_id=c.id AND m.status='pending'),'[]'::jsonb) ELSE '[]'::jsonb END,
    'members',COALESCE((SELECT jsonb_agg(m.gh_user_id ORDER BY m.joined_at ASC) FROM public.gh_community_members m WHERE m.community_id=c.id AND m.status='active'),'[]'::jsonb),
    'moderation',CASE WHEN v_role IN ('owner','admin','moderator') THEN jsonb_build_object('openReports',(SELECT count(*) FROM public.gh_community_reports r WHERE r.community_id=c.id AND r.status IN ('open','reviewing')),'recentActions',(SELECT count(*) FROM public.gh_community_moderation_log l WHERE l.community_id=c.id AND l.created_at>now()-interval '7 days')) ELSE '{}'::jsonb END
  ) INTO v_json;
  RETURN jsonb_build_object('ok',true,'community',v_json);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_community_announcement_create(p_community_id text,p_actor_id text,p_title text,p_content text,p_type text DEFAULT 'info',p_pinned boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE role text; v_id text := 'ann_'||replace(gen_random_uuid()::text,'-',''); rec public.gh_community_announcements%ROWTYPE;
BEGIN
  role:=public.gh_community_platform_role(p_community_id,p_actor_id);
  IF role NOT IN ('owner','admin','moderator') THEN RETURN jsonb_build_object('ok',false,'error','FORBIDDEN'); END IF;
  IF length(trim(p_title))=0 OR length(trim(p_title))>160 OR length(trim(p_content))=0 OR length(p_content)>10000 THEN RETURN jsonb_build_object('ok',false,'error','INVALID'); END IF;
  IF p_type NOT IN ('info','important','celebration','maintenance') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_TYPE'); END IF;
  INSERT INTO public.gh_community_announcements(id,community_id,author_id,title,content,announcement_type,pinned) VALUES(v_id,p_community_id,p_actor_id,trim(p_title),trim(p_content),p_type,p_pinned) RETURNING * INTO rec;
  INSERT INTO public.gh_community_moderation_log(id,community_id,actor_id,action,target_type,target_id,metadata) VALUES('mlog_'||replace(gen_random_uuid()::text,'-',''),p_community_id,p_actor_id,'announcement','announcement',rec.id,jsonb_build_object('title',rec.title));
  PERFORM public.gh_notification_event_append('community_announcement:'||rec.id||':'||m.gh_user_id,m.gh_user_id,p_actor_id,'community.announcement.created','community',p_community_id,NULL,NULL,jsonb_build_object('announcementId',rec.id,'title',rec.title)) FROM public.gh_community_members m WHERE m.community_id=p_community_id AND m.status='active' AND m.gh_user_id<>p_actor_id;
  RETURN jsonb_build_object('ok',true,'announcement',jsonb_build_object('id',rec.id,'communityId',rec.community_id,'authorId',rec.author_id,'title',rec.title,'content',rec.content,'type',rec.announcement_type,'pinned',rec.pinned,'createdAt',extract(epoch FROM rec.created_at)*1000));
END; $$;

CREATE OR REPLACE FUNCTION public.gh_community_event_create(p_community_id text,p_actor_id text,p_title text,p_description text,p_starts_at timestamptz,p_ends_at timestamptz,p_location text DEFAULT NULL,p_virtual_link text DEFAULT NULL,p_category text DEFAULT 'meeting')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE role text; v_id text := 'evt_'||replace(gen_random_uuid()::text,'-',''); rec public.gh_community_events%ROWTYPE;
BEGIN
  role:=public.gh_community_platform_role(p_community_id,p_actor_id);
  IF role NOT IN ('owner','admin','moderator') THEN RETURN jsonb_build_object('ok',false,'error','FORBIDDEN'); END IF;
  IF length(trim(p_title))=0 OR length(trim(p_title))>160 OR p_ends_at<=p_starts_at THEN RETURN jsonb_build_object('ok',false,'error','INVALID'); END IF;
  IF p_category NOT IN ('meeting','social','workshop','discussion','celebration') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_CATEGORY'); END IF;
  INSERT INTO public.gh_community_events(id,community_id,creator_id,title,description,starts_at,ends_at,location,virtual_link,category) VALUES(v_id,p_community_id,p_actor_id,trim(p_title),left(coalesce(p_description,''),10000),p_starts_at,p_ends_at,NULLIF(left(coalesce(p_location,''),500),''),NULLIF(left(coalesce(p_virtual_link,''),2000),''),p_category) RETURNING * INTO rec;
  INSERT INTO public.gh_community_event_rsvps(event_id,user_id,status) VALUES(rec.id,p_actor_id,'going');
  INSERT INTO public.gh_community_moderation_log(id,community_id,actor_id,action,target_type,target_id,metadata) VALUES('mlog_'||replace(gen_random_uuid()::text,'-',''),p_community_id,p_actor_id,'event','event',rec.id,'{}'::jsonb);
  PERFORM public.gh_notification_event_append('community_event:'||rec.id||':'||m.gh_user_id,m.gh_user_id,p_actor_id,'community.event.created','community',p_community_id,NULL,NULL,jsonb_build_object('eventId',rec.id,'title',rec.title)) FROM public.gh_community_members m WHERE m.community_id=p_community_id AND m.status='active' AND m.gh_user_id<>p_actor_id;
  RETURN jsonb_build_object('ok',true,'event',jsonb_build_object('id',rec.id,'groupId',rec.community_id,'creatorId',rec.creator_id,'title',rec.title,'description',rec.description,'startsAt',extract(epoch FROM rec.starts_at)*1000,'endsAt',extract(epoch FROM rec.ends_at)*1000,'status',rec.status,'location',rec.location,'virtualLink',rec.virtual_link,'category',rec.category,'attendees',jsonb_build_array(p_actor_id),'rsvpStatus','going'));
END; $$;

CREATE OR REPLACE FUNCTION public.gh_community_event_rsvp(p_event_id text,p_actor_id text,p_status text DEFAULT 'going')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.gh_community_events%ROWTYPE; member_status text; count_going integer;
BEGIN
  SELECT * INTO e FROM public.gh_community_events WHERE id=p_event_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  SELECT status INTO member_status FROM public.gh_community_members WHERE community_id=e.community_id AND gh_user_id=p_actor_id;
  IF member_status <> 'active' THEN RETURN jsonb_build_object('ok',false,'error','FORBIDDEN'); END IF;
  IF p_status NOT IN ('going','maybe','declined') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_STATUS'); END IF;
  INSERT INTO public.gh_community_event_rsvps(event_id,user_id,status) VALUES(p_event_id,p_actor_id,p_status) ON CONFLICT(event_id,user_id) DO UPDATE SET status=EXCLUDED.status,updated_at=now();
  SELECT count(*) INTO count_going FROM public.gh_community_event_rsvps WHERE event_id=p_event_id AND status='going';
  RETURN jsonb_build_object('ok',true,'status',p_status,'rsvpCount',count_going);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_community_resource_upsert(p_community_id text,p_actor_id text,p_id text,p_title text,p_description text,p_type text,p_url text DEFAULT NULL,p_content text DEFAULT NULL,p_sort_order integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE role text; v_id text:=coalesce(nullif(trim(p_id),''),'res_'||replace(gen_random_uuid()::text,'-','')); rec public.gh_community_resources%ROWTYPE;
BEGIN
  role:=public.gh_community_platform_role(p_community_id,p_actor_id);
  IF role NOT IN ('owner','admin','moderator') THEN RETURN jsonb_build_object('ok',false,'error','FORBIDDEN'); END IF;
  IF length(trim(p_title))=0 OR length(trim(p_title))>180 OR p_type NOT IN ('document','link','guide','template','media') OR (nullif(trim(coalesce(p_url,'')),'') IS NULL AND nullif(trim(coalesce(p_content,'')),'') IS NULL) THEN RETURN jsonb_build_object('ok',false,'error','INVALID'); END IF;
  INSERT INTO public.gh_community_resources(id,community_id,uploaded_by,title,description,resource_type,url,content,sort_order) VALUES(v_id,p_community_id,p_actor_id,trim(p_title),left(coalesce(p_description,''),2000),p_type,NULLIF(trim(p_url),''),NULLIF(trim(p_content),''),greatest(0,p_sort_order)) ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,resource_type=EXCLUDED.resource_type,url=EXCLUDED.url,content=EXCLUDED.content,sort_order=EXCLUDED.sort_order,updated_at=now() WHERE gh_community_resources.community_id=p_community_id;
  SELECT * INTO rec FROM public.gh_community_resources WHERE id=v_id;
  INSERT INTO public.gh_community_moderation_log(id,community_id,actor_id,action,target_type,target_id,metadata) VALUES('mlog_'||replace(gen_random_uuid()::text,'-',''),p_community_id,p_actor_id,'resource','resource',v_id,jsonb_build_object('title',rec.title));
  RETURN jsonb_build_object('ok',true,'resource',jsonb_build_object('id',rec.id,'groupId',rec.community_id,'title',rec.title,'description',rec.description,'resourceType',rec.resource_type,'url',rec.url,'content',rec.content,'uploadedBy',rec.uploaded_by,'uploadedAt',extract(epoch FROM rec.created_at)*1000,'order',rec.sort_order,'pinned',rec.pinned));
END; $$;

CREATE OR REPLACE FUNCTION public.gh_community_report_create(p_community_id text,p_actor_id text,p_target_type text,p_target_id text,p_reason text,p_note text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE role text; v_id text:='crep_'||replace(gen_random_uuid()::text,'-','');
BEGIN
  SELECT public.gh_community_platform_role(p_community_id,p_actor_id) INTO role;
  IF role IS NULL AND NOT EXISTS(SELECT 1 FROM public.gh_communities WHERE id=p_community_id AND privacy='public' AND deleted_at IS NULL) THEN RETURN jsonb_build_object('ok',false,'error','FORBIDDEN'); END IF;
  IF p_target_type NOT IN ('community','post','member','event','resource') OR p_reason NOT IN ('spam','harassment','hate','misinformation','impersonation','safety','other') OR trim(p_target_id)='' THEN RETURN jsonb_build_object('ok',false,'error','INVALID'); END IF;
  INSERT INTO public.gh_community_reports(id,community_id,reporter_id,target_type,target_id,reason,note) VALUES(v_id,p_community_id,p_actor_id,p_target_type,p_target_id,p_reason,left(coalesce(p_note,''),2000)) ON CONFLICT(community_id,reporter_id,target_type,target_id,reason) WHERE status IN ('open','reviewing') DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM public.gh_community_reports WHERE id=v_id) THEN RETURN jsonb_build_object('ok',true,'duplicate',true); END IF;
  INSERT INTO public.gh_community_moderation_log(id,community_id,actor_id,action,target_type,target_id,metadata) VALUES('mlog_'||replace(gen_random_uuid()::text,'-',''),p_community_id,p_actor_id,'report','report',v_id,jsonb_build_object('targetType',p_target_type,'targetId',p_target_id,'reason',p_reason));
  RETURN jsonb_build_object('ok',true,'reportId',v_id);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_community_report_resolve(p_community_id text,p_actor_id text,p_report_id text,p_status text,p_resolution_note text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE role text; reporter text;
BEGIN
  role:=public.gh_community_platform_role(p_community_id,p_actor_id);
  IF role NOT IN ('owner','admin','moderator') THEN RETURN jsonb_build_object('ok',false,'error','FORBIDDEN'); END IF;
  IF p_status NOT IN ('reviewing','resolved','dismissed') THEN RETURN jsonb_build_object('ok',false,'error','INVALID_STATUS'); END IF;
  UPDATE public.gh_community_reports SET status=p_status,resolution_note=left(coalesce(p_resolution_note,''),2000),resolved_by=p_actor_id,resolved_at=CASE WHEN p_status IN ('resolved','dismissed') THEN now() ELSE NULL END WHERE id=p_report_id AND community_id=p_community_id RETURNING reporter_id INTO reporter;
  IF reporter IS NULL THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  INSERT INTO public.gh_community_moderation_log(id,community_id,actor_id,action,target_type,target_id,metadata) VALUES('mlog_'||replace(gen_random_uuid()::text,'-',''),p_community_id,p_actor_id,'report','report',p_report_id,jsonb_build_object('status',p_status));
  RETURN jsonb_build_object('ok',true,'status',p_status);
END; $$;

CREATE OR REPLACE FUNCTION public.gh_community_member_remove(p_community_id text,p_actor_id text,p_target_id text,p_ban boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ar text; tr text;
BEGIN
  ar:=public.gh_community_platform_role(p_community_id,p_actor_id);
  IF ar NOT IN ('owner','admin','moderator') THEN RETURN jsonb_build_object('ok',false,'error','FORBIDDEN'); END IF;
  SELECT role INTO tr FROM public.gh_community_members WHERE community_id=p_community_id AND gh_user_id=p_target_id;
  IF tr IS NULL THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  IF tr='owner' OR p_target_id=p_actor_id THEN RETURN jsonb_build_object('ok',false,'error','CANNOT_REMOVE'); END IF;
  IF ar='moderator' AND tr IN ('admin','moderator') THEN RETURN jsonb_build_object('ok',false,'error','FORBIDDEN'); END IF;
  UPDATE public.gh_community_members SET status=CASE WHEN p_ban THEN 'banned' ELSE 'left' END WHERE community_id=p_community_id AND gh_user_id=p_target_id;
  UPDATE public.gh_communities SET member_count=(SELECT count(*) FROM public.gh_community_members WHERE community_id=p_community_id AND status='active'),updated_at=now() WHERE id=p_community_id;
  INSERT INTO public.gh_community_moderation_log(id,community_id,actor_id,action,target_type,target_id,metadata) VALUES('mlog_'||replace(gen_random_uuid()::text,'-',''),p_community_id,p_actor_id,CASE WHEN p_ban THEN 'ban_member' ELSE 'remove_member' END,'member',p_target_id,'{}'::jsonb);
  RETURN jsonb_build_object('ok',true,'status',CASE WHEN p_ban THEN 'banned' ELSE 'left' END);
END; $$;

REVOKE ALL ON FUNCTION public.gh_community_platform_role(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_community_platform_get(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_community_announcement_create(text,text,text,text,text,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_community_event_create(text,text,text,text,timestamptz,timestamptz,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_community_event_rsvp(text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_community_resource_upsert(text,text,text,text,text,text,text,text,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_community_report_create(text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_community_report_resolve(text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gh_community_member_remove(text,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gh_community_platform_role(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_platform_get(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_announcement_create(text,text,text,text,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_event_create(text,text,text,text,timestamptz,timestamptz,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_event_rsvp(text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_resource_upsert(text,text,text,text,text,text,text,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_report_create(text,text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_report_resolve(text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_member_remove(text,text,text,boolean) TO service_role;
