#!/usr/bin/env node
/**
 * Prints the migration verification checklist (no DB access).
 * Live proof requires Supabase SQL + GET /api/health.
 */
console.log(`
GH-CONNECT migration checklist
===============================
1) Apply (Staging first):
   - 20260908_gh_pi_identities.sql
   - 20260908_gh_sessions.sql
   - 20260919_gh_user_profiles_and_progress.sql
   - 20260919_gh_messaging_durable.sql
   - prior economy migrations as needed

2) SQL: select to_regclass('public.gh_pi_identities'); (and sessions, profiles, messages)

3) GET /api/health → identity_durable, session_durable, supabase_config pass

4) docs/MIGRATION_CHECKLIST.md for full steps
`)
`)
