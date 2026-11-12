-- Run #285: durable per-user direct-message reactions.
-- Depends on gh_messages / gh_conversations / gh_conversation_members.
-- Server-only RPC; clients receive aggregate counts and their own selected emoji only.
BEGIN;

CREATE TABLE IF NOT EXISTS public.gh_message_reactions (
  conversation_id text NOT NULL REFERENCES public.gh_conversations(id) ON DELETE CASCADE,
  message_id text NOT NULL REFERENCES public.gh_messages(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  emoji text NOT NULL CHECK (emoji IN ('❤️','👍','😂','😮','😢','🙏','🔥','🎉')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, actor_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_gh_message_reactions_conversation_message
  ON public.gh_message_reactions (conversation_id, message_id);
CREATE INDEX IF NOT EXISTS idx_gh_message_reactions_actor_recent
  ON public.gh_message_reactions (actor_id, created_at DESC);

ALTER TABLE public.gh_message_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gh_message_reactions_no_client ON public.gh_message_reactions;
CREATE POLICY gh_message_reactions_no_client ON public.gh_message_reactions
  FOR ALL USING (false) WITH CHECK (false);
REVOKE ALL ON TABLE public.gh_message_reactions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.gh_message_reactions TO service_role;

CREATE OR REPLACE FUNCTION public.gh_message_toggle_reaction(
  p_conversation_id text,
  p_message_id text,
  p_actor_id text,
  p_emoji text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_active boolean;
  v_deleted_at timestamptz;
  v_counts jsonb;
  v_viewer text[];
BEGIN
  IF p_actor_id IS NULL OR length(trim(p_actor_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED');
  END IF;
  IF p_emoji IS NULL OR p_emoji NOT IN ('❤️','👍','😂','😮','😢','🙏','🔥','🎉') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_REACTION');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.gh_conversation_members
    WHERE conversation_id = p_conversation_id AND gh_user_id = p_actor_id AND left_at IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  SELECT deleted_at INTO v_deleted_at FROM public.gh_messages
    WHERE id = p_message_id AND conversation_id = p_conversation_id FOR UPDATE;
  IF NOT FOUND OR v_deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  DELETE FROM public.gh_message_reactions
    WHERE conversation_id = p_conversation_id AND message_id = p_message_id
      AND actor_id = p_actor_id AND emoji = p_emoji;
  v_active := NOT FOUND;
  IF v_active THEN
    INSERT INTO public.gh_message_reactions(conversation_id,message_id,actor_id,emoji)
    VALUES(p_conversation_id,p_message_id,p_actor_id,p_emoji)
    ON CONFLICT DO NOTHING;
  END IF;
  SELECT coalesce(jsonb_object_agg(emoji, reaction_count), '{}'::jsonb)
    INTO v_counts FROM (
      SELECT emoji, count(*)::integer AS reaction_count
      FROM public.gh_message_reactions
      WHERE conversation_id = p_conversation_id AND message_id = p_message_id
      GROUP BY emoji
    ) counts;
  SELECT coalesce(array_agg(emoji ORDER BY emoji), ARRAY[]::text[])
    INTO v_viewer FROM public.gh_message_reactions
    WHERE conversation_id = p_conversation_id AND message_id = p_message_id AND actor_id = p_actor_id;
  RETURN jsonb_build_object('ok', true, 'active', v_active,
    'reaction_counts', v_counts, 'viewer_reactions', to_jsonb(v_viewer));
END; $$;

REVOKE ALL ON FUNCTION public.gh_message_toggle_reaction(text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_message_toggle_reaction(text,text,text,text) TO service_role;

COMMIT;
