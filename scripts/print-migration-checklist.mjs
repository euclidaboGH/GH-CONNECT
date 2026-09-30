#!/usr/bin/env node
/**
 * Prints the migration verification checklist (no DB access).
 * Live proof requires Supabase SQL + GET /api/health.
 * Classification details: docs/MIGRATION_CHECKLIST.md
 */
import { readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const migDir = join(root, "supabase", "migrations")

const PROPOSAL = new Set([
  "20260906_community_join_reasons_proposal.sql",
  "20260907_community_governance_log_proposal.sql",
])
const REQUIRES_APPROVAL = new Set([
  "20260905_connection_request_intents.sql",
])

function classify(name) {
  if (PROPOSAL.has(name)) return "PROPOSAL"
  if (REQUIRES_APPROVAL.has(name)) return "REQUIRES_APPROVAL"
  return "REQUIRED"
}

let files = []
try {
  files = readdirSync(migDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
} catch {
  files = []
}

const byClass = { REQUIRED: [], REQUIRES_APPROVAL: [], PROPOSAL: [] }
for (const f of files) {
  byClass[classify(f)].push(f)
}

const lines = files.map((f) => `   [${classify(f).padEnd(17)}] ${f}`)

console.log(`
GH-CONNECT migration checklist
===============================
On-disk migrations: ${files.length}
  REQUIRED:            ${byClass.REQUIRED.length}
  REQUIRES_APPROVAL:   ${byClass.REQUIRES_APPROVAL.length}
  PROPOSAL:            ${byClass.PROPOSAL.length}

Per-file class:
${lines.join("\n") || "   (none found)"}

Apply policy:
  - REQUIRED → oldest → newest on Testnet (then Production when ready)
  - REQUIRES_APPROVAL → only after product/security review
  - PROPOSAL → do NOT apply without explicit approval

Staging order (REQUIRED groups, oldest first):
1) Economy / ledger / accounts / payment intents / membership
2) Pi identities + sessions + profiles
3) Messaging durable
4) Marketplace listings + orders
5) Social core + communities + polls + ACL lockdown
6) Phase 1–13 social/economy (20260926 → 20261005b)

There are no Phase 14/15 migrations in this repository.

Verify after apply (SQL):
  select to_regclass('public.gh_pi_identities');
  select to_regclass('public.gh_sessions');
  select to_regclass('public.gh_posts');
  select to_regclass('public.gh_post_shares');
  select to_regclass('public.gh_social_notifications');

GET /api/health → identity_durable, session_durable, supabase_config

Full inventory: docs/MIGRATION_CHECKLIST.md
Deferred/gated surfaces: docs/DEFERRED_AND_GATED.md
`)
