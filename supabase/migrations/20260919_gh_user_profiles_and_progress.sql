-- Canonical user profile + achievement progress (cross-device, server-authoritative).
-- Linked to verified GH user id (same key space as gh_pi_identities.gh_user_id).
-- Additive only. No destructive changes. Service-role writes; client RLS deny-all.
-- Financial balances remain in ghc_transactions / ghc_wallet_snapshot — never stored here.

CREATE TABLE IF NOT EXISTS public.gh_user_profiles (
  gh_user_id            text PRIMARY KEY,
  display_name          text,
  username              text,
  bio                   text,
  city                  text,
  country               text,
  profession            text,
  hometown              text,
  education             text,
  status                text,
  age                   integer,
  gender                text,
  primary_mode          text,
  interests             jsonb NOT NULL DEFAULT '[]'::jsonb,
  connection_intents    jsonb NOT NULL DEFAULT '[]'::jsonb,
  skills                jsonb NOT NULL DEFAULT '[]'::jsonb,
  photos                jsonb NOT NULL DEFAULT '[]'::jsonb,
  cover_photo           text,
  profile_payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  onboarded             boolean NOT NULL DEFAULT false,
  schema_version        integer NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_user_profiles_user_nonempty CHECK (length(trim(gh_user_id)) > 0),
  CONSTRAINT gh_user_profiles_age_range CHECK (age IS NULL OR (age >= 18 AND age <= 120)),
  CONSTRAINT gh_user_profiles_photos_array CHECK (jsonb_typeof(photos) = 'array'),
  CONSTRAINT gh_user_profiles_interests_array CHECK (jsonb_typeof(interests) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_gh_user_profiles_onboarded
  ON public.gh_user_profiles (onboarded);

CREATE INDEX IF NOT EXISTS idx_gh_user_profiles_updated
  ON public.gh_user_profiles (updated_at DESC);

ALTER TABLE public.gh_user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_user_profiles_no_client_access ON public.gh_user_profiles;
CREATE POLICY gh_user_profiles_no_client_access ON public.gh_user_profiles
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.gh_user_profiles IS
  'Server-authoritative social profile for GH users. Not balances/membership. Service-role only.';

-- Achievement unlocks (idempotent per user + achievement id)
CREATE TABLE IF NOT EXISTS public.gh_user_achievements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gh_user_id      text NOT NULL,
  achievement_id  text NOT NULL,
  unlocked_at     timestamptz NOT NULL DEFAULT now(),
  source_event    text,
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT gh_user_achievements_user_nonempty CHECK (length(trim(gh_user_id)) > 0),
  CONSTRAINT gh_user_achievements_id_nonempty CHECK (length(trim(achievement_id)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gh_user_achievements_user_achievement
  ON public.gh_user_achievements (gh_user_id, achievement_id);

CREATE INDEX IF NOT EXISTS idx_gh_user_achievements_user
  ON public.gh_user_achievements (gh_user_id);

ALTER TABLE public.gh_user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_user_achievements_no_client_access ON public.gh_user_achievements;
CREATE POLICY gh_user_achievements_no_client_access ON public.gh_user_achievements
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.gh_user_achievements IS
  'Server-authoritative achievement unlocks. Claims must be validated server-side. Service-role only.';

-- Lightweight progress counters (non-financial)
CREATE TABLE IF NOT EXISTS public.gh_user_progress (
  gh_user_id      text PRIMARY KEY,
  counters        jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gh_user_progress_user_nonempty CHECK (length(trim(gh_user_id)) > 0),
  CONSTRAINT gh_user_progress_counters_object CHECK (jsonb_typeof(counters) = 'object')
);

ALTER TABLE public.gh_user_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_user_progress_no_client_access ON public.gh_user_progress;
CREATE POLICY gh_user_progress_no_client_access ON public.gh_user_progress
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.gh_user_progress IS
  'Non-financial progress counters. Not GHC balances. Service-role only.';
