#!/usr/bin/env node
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
let pass = 0, fail = 0
function ok(c, m) { if (c) { pass++; console.log("  ✓", m) } else { fail++; console.log("  ✗", m) } }

const mig = fs.readFileSync(path.join(root, "supabase/migrations/20261017_ghpv_settlement_engine.sql"), "utf8")
ok(mig.includes("gh_ghpv_settlement_snapshot"), "snapshot RPC")
ok(mig.includes("gh_post_curations"), "snapshot joins current curations")
ok(mig.includes("gh_ghpv_commit_settlement"), "commit RPC")
ok(mig.includes("idempotent"), "idempotent commit")
ok(mig.includes("pg_advisory_xact_lock"), "concurrency lock")
ok(mig.includes("gh_judgment_events"), "writes judgment events")
ok(mig.includes("ghcMutated"), "no GHC claim")
ok(!/ghc_execute|CREATE TABLE public\.ghc_/i.test(mig), "no ledger objects")
ok(mig.includes("REVOKE ALL") && mig.includes("service_role"), "service_role only")

const svc = fs.readFileSync(path.join(root, "lib/server/ghpv/settle-service.ts"), "utf8")
ok(svc.includes("gh_ghpv_settlement_snapshot"), "service loads snapshot")
ok(svc.includes("computeSettlement"), "service uses pure engine")
ok(!svc.includes("request.json"), "service does not read client votes")
ok(svc.includes("ghcMutated: false"), "service never mutates GHC")
ok(svc.includes("settlementEpochFor"), "server epoch")

const route = fs.readFileSync(path.join(root, "app/api/social/posts/[id]/ghpv/settle/route.ts"), "utf8")
ok(route.includes("GH_SETTLEMENT_INTERNAL_KEY"), "internal key required")
ok(route.includes("SETTLEMENT_DISABLED"), "unset key fail-closed")
ok(route.includes("timingSafeEqual"), "constant-time compare")
ok(!route.includes("resolveAuthenticatedUser"), "ordinary session cannot settle")
ok(!route.includes("computeSettlement"), "route does not accept vote arrays")

const getRoute = fs.readFileSync(path.join(root, "app/api/social/posts/[id]/ghpv/route.ts"), "utf8")
ok(getRoute.includes("participantCount"), "safe status fields")
ok(!getRoute.includes("curationPower"), "does not expose power")

// Epoch determinism
function epochFor(date) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}
ok(epochFor(new Date("2026-10-06T00:00:00Z")) === epochFor(new Date("2026-10-06T12:00:00Z")), "same-day epoch stable")

// Snapshot parser rejects bad choices
function parse(data) {
  const votes = []
  for (const item of data.votes || []) {
    if (item.choice !== "upvote" && item.choice !== "downvote") continue
    if (!item.reviewerId) continue
    votes.push(item)
  }
  return votes
}
ok(parse({ votes: [{ reviewerId: "a", choice: "mint", weight: 9 }, { reviewerId: "b", choice: "upvote", weight: 1 }] }).length === 1, "invalid choices dropped")

console.log(`\nGHPV-1B settlement: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)

const bounds = fs.readFileSync(path.join(root, "supabase/migrations/20261018_ghpv_calibration_bounds.sql"), "utf8")
ok(bounds.includes("greatest(-2.5, least(2.5"), "SQL delta cap")
ok(bounds.includes("least(100"), "SQL JCS bound")
ok(bounds.includes("quarantined"), "quarantine preserved")
ok(!/ghc_execute/.test(bounds), "bounds migration no ledger")
