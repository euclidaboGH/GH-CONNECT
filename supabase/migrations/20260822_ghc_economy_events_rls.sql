-- D6.1: RLS on economy notification events — clients cannot forge financial notifications

ALTER TABLE public.ghc_economy_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ghc_economy_events_select_own ON public.ghc_economy_events;
CREATE POLICY ghc_economy_events_select_own ON public.ghc_economy_events
  FOR SELECT
  USING (auth.uid()::text = user_id);
  -- Note: production apps using Pi user ids (non-Supabase auth) should rely on
  -- service-role API routes only; tighten USING to auth.uid()::text = user_id
  -- when Supabase Auth subjects match user_id.

DROP POLICY IF EXISTS ghc_economy_events_no_client_write ON public.ghc_economy_events;
CREATE POLICY ghc_economy_events_no_client_write ON public.ghc_economy_events
  FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS ghc_economy_events_no_client_update ON public.ghc_economy_events;
CREATE POLICY ghc_economy_events_no_client_update ON public.ghc_economy_events
  FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS ghc_economy_events_no_client_delete ON public.ghc_economy_events;
CREATE POLICY ghc_economy_events_no_client_delete ON public.ghc_economy_events
  FOR DELETE
  USING (false);

-- Service role bypasses RLS; all writes go through SECURITY DEFINER RPCs / service role.
