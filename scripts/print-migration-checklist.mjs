#!/usr/bin/env node
/**
 * Prints the migration verification checklist (no DB access).
 * Live proof requires Supabase SQL + GET /api/health.
 */
import { readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const migDir = join(root, "supabase", "migrations")
let files = []
try {
  files = readdirSync(migDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
} catch {
  files = []
}

console.log(`
GH-CONNECT migration checklist
===============================
On-disk migrations (${files.length}):
${files.map((f) => "   - " + f).join("\n") || "   (none found)"}

Staging order (apply all, oldest first):
1) Economy / ledger / accounts / payment intents / membership
2) Pi identities + sessions + profiles
3) Messaging durable
4) Marketplace listings + orders
5) Social core + communities + pass5 soft limits/polls
6) Poll vote validation (20260923_gh_poll_vote_validate.sql)

Verify after apply:
  select to_regclass('public.gh_pi_identities');
  select to_regclass('public.gh_sessions');
  select to_regclass('public.gh_conversations');
  select to_regclass('public.gh_posts');
  select to_regclass('public.gh_communities');
  select to_regclass('public.gh_user_mutes');
  select to_regclass('public.gh_polls');

GET /api/health → identity_durable, session_durable, supabase_config

See docs/MIGRATION_CHECKLIST.md for operator steps.
`)
