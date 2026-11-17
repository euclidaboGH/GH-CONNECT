-- GreenHaven reputation integrity hardening.
-- TESTNET first. This migration adds a database-level guard so service code
-- cannot accidentally write non-canonical points for catalogued events.
-- It does not invent negative vote penalties or make curation a reputation award.

CREATE OR REPLACE FUNCTION public.gh_reputation_validate_event_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_expected integer;
BEGIN
  v_expected := CASE NEW.event_type
    WHEN 'profile_complete' THEN 25
    WHEN 'first_post' THEN 15
    WHEN 'community_join' THEN 10
    WHEN 'marketplace_order_complete' THEN 20
    WHEN 'report_resolved_helpful' THEN 5
    WHEN 'manual_adjustment_credit' THEN NULL
    ELSE -1
  END;

  IF v_expected = -1 THEN
    RAISE EXCEPTION 'Unsupported reputation event type: %', NEW.event_type
      USING ERRCODE = '22023';
  END IF;
  IF v_expected IS NOT NULL AND NEW.points <> v_expected THEN
    RAISE EXCEPTION 'Non-canonical reputation points for %: expected %, got %',
      NEW.event_type, v_expected, NEW.points
      USING ERRCODE = '22023';
  END IF;
  IF NEW.points < 0 OR NEW.points > 10000 THEN
    RAISE EXCEPTION 'Reputation points outside permitted range'
      USING ERRCODE = '22023';
  END IF;
  IF NEW.event_type = 'manual_adjustment_credit' AND NEW.points <= 0 THEN
    RAISE EXCEPTION 'Manual reputation adjustment must be positive'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gh_reputation_event_points_guard ON public.gh_reputation_events;
CREATE TRIGGER gh_reputation_event_points_guard
BEFORE INSERT OR UPDATE OF event_type, points
ON public.gh_reputation_events
FOR EACH ROW EXECUTE FUNCTION public.gh_reputation_validate_event_points();

REVOKE ALL ON FUNCTION public.gh_reputation_validate_event_points() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gh_reputation_validate_event_points() TO service_role;

COMMENT ON FUNCTION public.gh_reputation_validate_event_points() IS
  'Database-level canonical point guard for reputation events; no curation vote penalties or GHC effects.';
