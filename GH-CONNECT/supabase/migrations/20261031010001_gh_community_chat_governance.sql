-- Community chat governance: owner-created, member opt-in, privacy-aware approval.
ALTER TABLE public.gh_communities
  ADD COLUMN IF NOT EXISTS chat_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chat_privacy text NOT NULL DEFAULT 'members'
    CHECK (chat_privacy IN ('members','approval'));

CREATE TABLE IF NOT EXISTS public.gh_community_chat_requests (
  community_id text NOT NULL REFERENCES public.gh_communities(id) ON DELETE CASCADE,
  gh_user_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by text,
  PRIMARY KEY (community_id, gh_user_id)
);
ALTER TABLE public.gh_community_chat_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_community_chat_requests_no_client ON public.gh_community_chat_requests;
CREATE POLICY gh_community_chat_requests_no_client ON public.gh_community_chat_requests FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.gh_community_chat_state(p_community_id text, p_user_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.gh_communities%ROWTYPE; v_member boolean; v_chat_member boolean; v_req text;
BEGIN
  SELECT * INTO c FROM public.gh_communities WHERE id=trim(p_community_id) AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  SELECT EXISTS(SELECT 1 FROM public.gh_community_members WHERE community_id=c.id AND gh_user_id=p_user_id AND status='active') INTO v_member;
  SELECT EXISTS(SELECT 1 FROM public.gh_conversation_members WHERE conversation_id=c.id AND gh_user_id=p_user_id AND left_at IS NULL) INTO v_chat_member;
  SELECT status INTO v_req FROM public.gh_community_chat_requests WHERE community_id=c.id AND gh_user_id=p_user_id;
  RETURN jsonb_build_object('ok',true,'enabled',c.chat_enabled,'privacy',c.chat_privacy,'communityMember',v_member,'chatMember',v_chat_member,'requestStatus',v_req,'owner',c.created_by=p_user_id);
END $$;

CREATE OR REPLACE FUNCTION public.gh_community_chat_create(p_community_id text, p_owner_id text, p_chat_privacy text DEFAULT 'members')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.gh_communities%ROWTYPE; v_priv text := CASE WHEN p_chat_privacy='approval' THEN 'approval' ELSE 'members' END;
BEGIN
  SELECT * INTO c FROM public.gh_communities WHERE id=trim(p_community_id) AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  IF c.created_by<>p_owner_id THEN RETURN jsonb_build_object('ok',false,'error','OWNER_ONLY'); END IF;
  INSERT INTO public.gh_conversations(id,kind,title,created_by,updated_at)
  VALUES(c.id,'community',left(c.name,120),p_owner_id,now())
  ON CONFLICT(id) DO UPDATE SET kind='community', title=EXCLUDED.title, updated_at=now();
  INSERT INTO public.gh_conversation_members(conversation_id,gh_user_id,role,left_at)
  VALUES(c.id,p_owner_id,'owner',NULL)
  ON CONFLICT(conversation_id,gh_user_id) DO UPDATE SET role='owner',left_at=NULL;
  UPDATE public.gh_communities SET chat_enabled=true,chat_privacy=v_priv,conversation_id=c.id,updated_at=now() WHERE id=c.id;
  RETURN jsonb_build_object('ok',true,'status','created','privacy',v_priv,'conversationId',c.id);
END $$;

CREATE OR REPLACE FUNCTION public.gh_community_chat_join(p_community_id text, p_user_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.gh_communities%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.gh_communities WHERE id=trim(p_community_id) AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  IF NOT c.chat_enabled THEN RETURN jsonb_build_object('ok',false,'error','CHAT_NOT_CREATED'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.gh_community_members WHERE community_id=c.id AND gh_user_id=p_user_id AND status='active') THEN
    RETURN jsonb_build_object('ok',false,'error','COMMUNITY_MEMBERSHIP_REQUIRED');
  END IF;
  IF c.created_by=p_user_id OR c.chat_privacy='members' THEN
    INSERT INTO public.gh_conversation_members(conversation_id,gh_user_id,role,left_at)
    VALUES(c.id,p_user_id,CASE WHEN c.created_by=p_user_id THEN 'owner' ELSE 'member' END,NULL)
    ON CONFLICT(conversation_id,gh_user_id) DO UPDATE SET left_at=NULL;
    INSERT INTO public.gh_community_chat_requests(community_id,gh_user_id,status,decided_at,decided_by)
    VALUES(c.id,p_user_id,'approved',now(),CASE WHEN c.created_by=p_user_id THEN p_user_id ELSE NULL END)
    ON CONFLICT(community_id,gh_user_id) DO UPDATE SET status='approved',decided_at=now();
    RETURN jsonb_build_object('ok',true,'status','active','conversationId',c.id);
  END IF;
  INSERT INTO public.gh_community_chat_requests(community_id,gh_user_id,status,requested_at,decided_at,decided_by)
  VALUES(c.id,p_user_id,'pending',now(),NULL,NULL)
  ON CONFLICT(community_id,gh_user_id) DO UPDATE SET status='pending',requested_at=now(),decided_at=NULL,decided_by=NULL;
  RETURN jsonb_build_object('ok',true,'status','pending');
END $$;

CREATE OR REPLACE FUNCTION public.gh_community_chat_review(p_community_id text,p_owner_id text,p_user_id text,p_approve boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.gh_communities%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.gh_communities WHERE id=p_community_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  IF c.created_by<>p_owner_id THEN RETURN jsonb_build_object('ok',false,'error','OWNER_ONLY'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.gh_community_chat_requests WHERE community_id=c.id AND gh_user_id=p_user_id AND status='pending') THEN RETURN jsonb_build_object('ok',false,'error','REQUEST_NOT_FOUND'); END IF;
  UPDATE public.gh_community_chat_requests SET status=CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,decided_at=now(),decided_by=p_owner_id WHERE community_id=c.id AND gh_user_id=p_user_id;
  IF p_approve THEN
    IF NOT EXISTS(SELECT 1 FROM public.gh_community_members WHERE community_id=c.id AND gh_user_id=p_user_id AND status='active') THEN RETURN jsonb_build_object('ok',false,'error','COMMUNITY_MEMBERSHIP_REQUIRED'); END IF;
    INSERT INTO public.gh_conversation_members(conversation_id,gh_user_id,role,left_at) VALUES(c.id,p_user_id,'member',NULL)
    ON CONFLICT(conversation_id,gh_user_id) DO UPDATE SET left_at=NULL;
  END IF;
  RETURN jsonb_build_object('ok',true,'status',CASE WHEN p_approve THEN 'approved' ELSE 'declined' END);
END $$;

REVOKE ALL ON TABLE public.gh_community_chat_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_community_chat_state(text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_community_chat_create(text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_community_chat_join(text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gh_community_chat_review(text,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_community_chat_state(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_chat_create(text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_chat_join(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.gh_community_chat_review(text,text,text,boolean) TO service_role;
