-- Durable, cross-device GreenHaven system announcements.
-- Announcement delivery is query-based (not a fan-out into every user's inbox).
-- No wallet, membership, reward, or ledger writes are performed here.

CREATE TABLE IF NOT EXISTS public.gh_system_announcements (
  id text PRIMARY KEY,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning', 'critical')),
  target text NOT NULL DEFAULT 'all' CHECK (target = 'all'),
  action_path text,
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at IS NULL OR expires_at > published_at),
  CHECK (action_path IS NULL OR (left(action_path, 1) = '/' AND left(action_path, 2) <> '//'))
);

CREATE INDEX IF NOT EXISTS idx_gh_system_announcements_active
  ON public.gh_system_announcements (published_at DESC, expires_at);

CREATE TABLE IF NOT EXISTS public.gh_system_announcement_reads (
  announcement_id text NOT NULL REFERENCES public.gh_system_announcements(id) ON DELETE CASCADE,
  gh_user_id text NOT NULL CHECK (length(trim(gh_user_id)) > 0),
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, gh_user_id)
);

CREATE INDEX IF NOT EXISTS idx_gh_system_announcement_reads_user
  ON public.gh_system_announcement_reads (gh_user_id, read_at DESC);

ALTER TABLE public.gh_system_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gh_system_announcement_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gh_system_announcements_no_client_access ON public.gh_system_announcements;
CREATE POLICY gh_system_announcements_no_client_access
  ON public.gh_system_announcements FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS gh_system_announcement_reads_no_client_access ON public.gh_system_announcement_reads;
CREATE POLICY gh_system_announcement_reads_no_client_access
  ON public.gh_system_announcement_reads FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.gh_system_announcements IS
  'Server-published global system notices visible to authenticated GreenHaven users across devices.';
COMMENT ON TABLE public.gh_system_announcement_reads IS
  'Per-user read state for global system notices; service-role API enforces session ownership.';
