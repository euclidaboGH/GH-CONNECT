-- Durable membership entitlements + activity emission caps (multi-instance)

CREATE TABLE IF NOT EXISTS public.ghc_membership_entitlements (
  user_id text PRIMARY KEY,
  tier text NOT NULL CHECK (tier IN ('free','vip','vvip')),
  active boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  expires_at timestamptz,
  billing_period text,
  source text NOT NULL DEFAULT 'default',
  purchase_ref text,
  payment_intent_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  audit jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ghc_membership_purchase_ref
  ON public.ghc_membership_entitlements (purchase_ref)
  WHERE purchase_ref IS NOT NULL;

ALTER TABLE public.ghc_membership_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ghc_membership_entitlements_no_client ON public.ghc_membership_entitlements;
CREATE POLICY ghc_membership_entitlements_no_client ON public.ghc_membership_entitlements
  FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.ghc_activity_emission_windows (
  user_id text NOT NULL,
  window_type text NOT NULL CHECK (window_type IN ('day','week')),
  window_key text NOT NULL,
  amount_ghc numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, window_type, window_key)
);

ALTER TABLE public.ghc_activity_emission_windows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ghc_activity_windows_no_client ON public.ghc_activity_emission_windows;
CREATE POLICY ghc_activity_windows_no_client ON public.ghc_activity_emission_windows
  FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.ghc_global_emission_demand (
  day_key text PRIMARY KEY,
  demand_after_m numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ghc_global_emission_demand ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ghc_global_demand_no_client ON public.ghc_global_emission_demand;
CREATE POLICY ghc_global_demand_no_client ON public.ghc_global_emission_demand
  FOR ALL USING (false) WITH CHECK (false);
