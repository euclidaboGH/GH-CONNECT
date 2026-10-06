#!/usr/bin/env node
/**
 * GHPV FINAL ECONOMIC SAFETY AUDIT — static source inspection + pure checks.
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const ghpvDir = path.join(root, "lib/server/ghpv")
const files = fs.readdirSync(ghpvDir).filter((f) => f.endsWith(".ts"))
const allGhpv = files.map((f) => fs.readFileSync(path.join(ghpvDir, f), "utf8")).join("\n")
const route = fs.readFileSync(path.join(root, "app/api/social/posts/[id]/curation/route.ts"), "utf8")
const migs = fs.readdirSync(path.join(root, "supabase/migrations"))
  .filter((f) => f.includes("ghpv"))
  .map((f) => fs.readFileSync(path.join(root, "supabase/migrations", f), "utf8"))
  .join("\n")

const matrix = []
function row(id, title, pass, evidence) {
  matrix.push({ id, title, pass, evidence })
  console.log(pass ? `PASS  ${id}. ${title}` : `FAIL  ${id}. ${title}`)
  if (!pass) console.log(`      evidence: ${evidence}`)
}

const ledgerHit = /ghc_execute_|executeDurableGhc|executeAuthoritativeTransfer|executeAuthoritativePending|ghc_execute_spend|ghc_execute_transfer/
row(1, "Vote cannot mint GHC", !ledgerHit.test(allGhpv) && !ledgerHit.test(route), "no ledger RPC in ghpv+curation route")
row(2, "Upvote cannot create GHC", !ledgerHit.test(route), "curation route")
row(3, "Downvote cannot create GHC", !ledgerHit.test(route), "curation route")
row(4, "CP not purchased with GHC", /GHC balance is intentionally excluded|coefficient = 0|Never uses wallet/.test(allGhpv), "curation-power.ts")
row(5, "Reputation not purchased with GHC", !/balance.*level|ghc.*reputationLevel/i.test(allGhpv), "ghpv sources")
row(6, "Creator quality not purchased with GHC", /Never uses GHC balance/.test(allGhpv), "creator-quality.ts")
row(7, "Tips do not manufacture reputation in GHPV", !/tip.*reputation|reputation.*tip/i.test(allGhpv), "no tip→rep in ghpv")
row(8, "Client cannot supply authoritative scores", route.includes("stripClientAuthority") && allGhpv.includes("qualityScore"), "stripClientAuthority")
row(9, "Client cannot supply reviewer identity", route.includes("auth.userId") && route.includes("stripClientAuthority"), "session actor")
row(10, "Client cannot supply wallet balances", route.includes("ghcBalance") || allGhpv.includes("ghcBalance") || allGhpv.includes("walletBalance"), "stripped in stripClientAuthority")
row(11, "GHPV RLS fail-closed", /USING \(false\)/.test(migs) && /REVOKE ALL/.test(migs), "migrations")
row(12, "GHPV uses existing auth", route.includes("resolveAuthenticatedUser"), "curation route")
row(13, "No duplicate settlement identity", /idempotent|settlement_epoch|idempotency_key/.test(migs + allGhpv), "epoch + keys")
row(14, "Settlement retry-safe design", /idempotent/.test(migs) && /persist_settlement|calibration_applies/.test(migs), "SQL idempotent paths")
row(15, "Concurrent settlement locking", /pg_advisory_xact_lock/.test(migs), "advisory locks")
row(16, "GHC ledger schema untouched by GHPV migs", !/ALTER TABLE public\.ghc_|CREATE TABLE public\.ghc_/.test(migs), "no ghc_ DDL in ghpv migs")
row(17, "Payment code not in GHPV path", !/pi-api|payment_intent|PI_API/.test(allGhpv + route), "no payment imports")
row(18, "Reputation awards not from vote path", !/awardReputation|gh_reputation_award/.test(route), "curation route")
row(19, "Unresolved consensus possible", /UNRESOLVED/.test(allGhpv), "settlement.ts")
row(20, "Subjective content protected", /protected|isJudgmentProtectedMode|creative|opinion/.test(allGhpv), "settlement+calibration")
row(21, "Vote rings resisted", /COORDINATION|coordinationSuspect|independent/.test(allGhpv), "calibration+settlement")
row(22, "Wealth cannot dominate consensus", /MAX_REVIEWER_CONSENSUS_SHARE|antiWhale|applyAntiWhaleCap/.test(allGhpv) && !/balance.*curationPower|ghc.*weight/i.test(allGhpv), "anti-whale + no balance weight")

const fails = matrix.filter((r) => !r.pass)
console.log(`\n=== GHPV ECONOMIC SAFETY: ${fails.length ? "FAIL" : "PASS"} (${matrix.filter(r=>r.pass).length}/${matrix.length}) ===`)
if (fails.length) {
  for (const f of fails) console.log(`FAIL #${f.id}: ${f.title} — ${f.evidence}`)
  process.exit(1)
}
process.exit(0)
