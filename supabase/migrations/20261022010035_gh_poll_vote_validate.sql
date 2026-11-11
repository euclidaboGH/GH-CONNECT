-- Pass 6: validate poll option belongs to poll; fail if closed
CREATE OR REPLACE FUNCTION public.gh_poll_vote(p_poll_id text, p_user_id text, p_option_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_options jsonb;
  v_closes timestamptz;
  v_found boolean := false;
  v_opt jsonb;
BEGIN
  SELECT options, closes_at INTO v_options, v_closes
  FROM public.gh_polls WHERE id = p_poll_id;
  IF v_options IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF v_closes IS NOT NULL AND v_closes < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CLOSED');
  END IF;
  FOR v_opt IN SELECT * FROM jsonb_array_elements(v_options)
  LOOP
    IF (v_opt->>'id') = p_option_id THEN
      v_found := true;
      EXIT;
    END IF;
  END LOOP;
  IF NOT v_found THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_OPTION');
  END IF;
  IF EXISTS (SELECT 1 FROM public.gh_poll_votes WHERE poll_id = p_poll_id AND user_id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ALREADY_VOTED');
  END IF;
  INSERT INTO public.gh_poll_votes (poll_id, user_id, option_id) VALUES (p_poll_id, p_user_id, p_option_id);
  RETURN jsonb_build_object('ok', true);
END; $$;
