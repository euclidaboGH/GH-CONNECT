-- D6.3 / D7: remove permissive OR true on economy events SELECT.
-- Clients must not read other users' notification/event rows via PostgREST.
-- Server uses service_role (bypasses RLS) for authorized notification APIs.

DROP POLICY IF EXISTS ghc_economy_events_select_own ON public.ghc_economy_events;
CREATE POLICY ghc_economy_events_select_own ON public.ghc_economy_events
  FOR SELECT
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS ghc_events_select_own ON public.ghc_economy_events;
CREATE POLICY ghc_events_select_own ON public.ghc_economy_events
  FOR SELECT
  USING (auth.uid()::text = user_id);
