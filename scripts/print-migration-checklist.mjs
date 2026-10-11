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
1) Economy / ledger / claims / membership / Pi intents (20260821 → 20260905 governor)
2) Pi identities + sessions + WebAuthn (20260908*)
3) Wallet snapshot + marketplace (20260911 → 20260912)
4) Verification + messaging + profiles (20260914 → 20260919)
5) Stage pending + ACL + communities + social core + polls (20260922 → 20260925)
6) Withdrawal + reactions + attention + curation + reputation + ads + creator (20260926 → 20260930)
7) Media / follow / notifications / search / shares / messaging prefs / archive (20261001 → 20261008)
8) Balance lock / spendable / withdrawal settle / activity stage (20261009 → 20261012)
9) GHPV judgment → weight → calibration → settlement infra (20261013 → 20261020)
10) Notification types + content rewards tables (20261021 → 20261022)

GHPV settlement is system-only; votes must not mint GHC.
There are no Phase 15 product migrations in this repository.
Phase 14 is hardening/verification (docs), not a new migration wave.

Full inventory: docs/MIGRATION_CHECKLIST.md
Gap report: docs/MIGRATION_GAP_REPORT.md

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
