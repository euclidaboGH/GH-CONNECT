-- GreenHaven Research Studio: owner-managed research projects and public responses.
-- All database access is mediated by authenticated server routes using service_role.
-- Anonymous respondents never receive direct Data API table privileges.

CREATE TABLE IF NOT EXISTS public.gh_research_projects (
  id uuid PRIMARY KEY,
  owner_user_id text NOT NULL CHECK (char_length(owner_user_id) BETWEEN 1 AND 256),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[A-Za-z0-9_-]{20,64}$'),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 140),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1200),
  project_type text NOT NULL CHECK (project_type IN ('survey', 'examination', 'election_observation', 'registration', 'custom')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'paused', 'closed')),
  form_schema jsonb NOT NULL CHECK (jsonb_typeof(form_schema) = 'object' AND pg_column_size(form_schema) <= 65536),
  settings jsonb NOT NULL DEFAULT '{"allow_anonymous":true,"response_limit":null}'::jsonb CHECK (jsonb_typeof(settings) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS gh_research_projects_owner_updated_idx
  ON public.gh_research_projects (owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS gh_research_projects_status_updated_idx
  ON public.gh_research_projects (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.gh_research_responses (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.gh_research_projects(id) ON DELETE CASCADE,
  submission_key text NOT NULL CHECK (char_length(submission_key) BETWEEN 16 AND 80),
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'object' AND pg_column_size(answers) <= 65536),
  consent_recorded_at timestamptz NOT NULL,
  review_status text NOT NULL DEFAULT 'received' CHECK (review_status IN ('received', 'pending_review', 'verified', 'flagged', 'rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, submission_key)
);

CREATE INDEX IF NOT EXISTS gh_research_responses_project_submitted_idx
  ON public.gh_research_responses (project_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS gh_research_responses_review_status_idx
  ON public.gh_research_responses (review_status, submitted_at DESC);

ALTER TABLE public.gh_research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_research_responses ENABLE ROW LEVEL SECURITY;

-- Keep public and end-user Data API roles out of these tables. API routes
-- enforce owner identity and public-link publication state before service access.
REVOKE ALL ON TABLE public.gh_research_projects FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.gh_research_responses FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gh_research_projects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gh_research_responses TO service_role;
