#!/usr/bin/env node
/**
 * GHPV-1A — active weight SET semantics (transitions A–J).
 * Pure simulation mirrors 20261016 migration logic.
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
let pass = 0
let fail = 0
function ok(c, m) {
  if (c) {
    pass++
    console.log("  ✓", m)
  } else {
    fail++
    console.log("  ✗", m)
  }
}

function apply(rows, reviewerId, choice, weight) {
  const id = String(reviewerId).trim()
  let next = rows.filter((r) => r.reviewerId !== id)
  if (choice === "upvote" || choice === "downvote") {
    next = [...next, { reviewerId: id, choice, weight: Math.max(0, weight) }]
  }
  let up = 0
  let down = 0
  for (const r of next) {
    if (r.choice === "upvote") up += r.weight
    else down += r.weight
  }
  return {
    rows: next,
    upvoteWeight: up,
    downvoteWeight: down,
    independentVoters: next.length,
  }
}

function assertAgg(s, label) {
  const sum = s.rows.reduce((a, r) => a + r.weight, 0)
  ok(
    Math.abs(s.upvoteWeight + s.downvoteWeight - sum) < 1e-9,
    `${label}: aggregates = sum of active rows`
  )
  ok(
    s.independentVoters === s.rows.length,
    `${label}: independent_voters = distinct active reviewers`
  )
  const ids = s.rows.map((r) => r.reviewerId)
  ok(new Set(ids).size === ids.length, `${label}: reviewer appears at most once`)
}

// --- Source checks ---
const mig = fs.readFileSync(
  path.join(root, "supabase/migrations/20261016_ghpv_active_weight_set_semantics.sql"),
  "utf8"
)
ok(mig.includes("gh_ghpv_active_weights"), "migration: active weights table")
ok(mig.includes("ON CONFLICT (content_id, reviewer_id) DO UPDATE"), "migration: set not add")
ok(mig.includes("gh_ghpv_recompute_quality_aggregates"), "migration: recompute aggregates")
ok(mig.includes("ghcMutated"), "migration: no GHC claim")
ok(mig.includes("REVOKE ALL") && mig.includes("service_role"), "migration: service_role only")
ok(mig.includes("USING (false)"), "migration: RLS deny-all")
ok(!/ghc_execute|CREATE TABLE public\.ghc_/i.test(mig), "migration: no GHC ledger touch")

const vw = fs.readFileSync(path.join(root, "lib/server/ghpv/vote-weight.ts"), "utf8")
ok(vw.includes("loadStoredCalibration"), "calibration load")
ok(vw.includes("calibrationSource"), "calibration source tag")
ok(vw.includes("gh_curator_calibration"), "reads calibration table")
ok(vw.includes("stripClientAuthority"), "strip client authority")
ok(vw.includes("jcs") && vw.includes("integrityScore"), "strips jcs/integrity forges")
ok(!/balance|wallet/.test(vw.match(/computeCurationPower\([\s\S]*?\)/)?.[0] || ""), "CP no balance")

const route = fs.readFileSync(
  path.join(root, "app/api/social/posts/[id]/curation/route.ts"),
  "utf8"
)
ok(route.includes("auth.userId"), "session actor")
ok(route.includes("stripClientAuthority"), "route strips forges")
ok(route.includes("gh_ghpv_record_curation_weight"), "route records weight")
ok(!route.includes("computeSettlement"), "settlement not called from vote")
ok(!/ghc_execute/.test(route), "no ledger on vote path")

// --- Transitions ---
let s = { rows: [], upvoteWeight: 0, downvoteWeight: 0, independentVoters: 0 }

// A. none → upvote
s = apply(s.rows, "u1", "upvote", 5)
ok(s.upvoteWeight === 5 && s.downvoteWeight === 0 && s.independentVoters === 1, "A none→upvote")
assertAgg(s, "A")

// C. upvote → same upvote (no inflation)
s = apply(s.rows, "u1", "upvote", 5)
ok(s.upvoteWeight === 5 && s.independentVoters === 1, "C repeated identical upvote no inflate")
assertAgg(s, "C")

// E. upvote → downvote
s = apply(s.rows, "u1", "downvote", 5)
ok(s.upvoteWeight === 0 && s.downvoteWeight === 5 && s.independentVoters === 1, "E upvote→downvote")
assertAgg(s, "E")

// D. downvote → same downvote
s = apply(s.rows, "u1", "downvote", 5)
ok(s.downvoteWeight === 5 && s.independentVoters === 1, "D repeated downvote no inflate")

// F. downvote → upvote
s = apply(s.rows, "u1", "upvote", 4)
ok(s.upvoteWeight === 4 && s.downvoteWeight === 0 && s.independentVoters === 1, "F downvote→upvote")

// G. upvote → neutral
s = apply(s.rows, "u1", "neutral", 0)
ok(s.upvoteWeight === 0 && s.downvoteWeight === 0 && s.independentVoters === 0, "G upvote→neutral")
assertAgg(s, "G")

// I. neutral → upvote
s = apply(s.rows, "u1", "upvote", 3)
ok(s.upvoteWeight === 3 && s.independentVoters === 1, "I neutral→upvote")

// H via downvote then neutral
s = apply(s.rows, "u1", "downvote", 2)
s = apply(s.rows, "u1", "neutral", 0)
ok(s.independentVoters === 0 && s.upvoteWeight === 0 && s.downvoteWeight === 0, "H downvote→neutral")

// B. none → downvote
s = apply([], "u2", "downvote", 6)
ok(s.downvoteWeight === 6 && s.independentVoters === 1, "B none→downvote")

// J. neutral → downvote
s = apply(s.rows, "u2", "neutral", 0)
s = apply(s.rows, "u2", "downvote", 7)
ok(s.downvoteWeight === 7 && s.independentVoters === 1, "J neutral→downvote")

// Two reviewers
s = apply([], "a", "upvote", 5)
s = apply(s.rows, "b", "downvote", 3)
ok(s.upvoteWeight === 5 && s.downvoteWeight === 3 && s.independentVoters === 2, "two reviewers two contributions")
assertAgg(s, "two-reviewer")

// Same reviewer never two active
s = apply(s.rows, "a", "downvote", 4)
ok(s.rows.filter((r) => r.reviewerId === "a").length === 1, "same reviewer single active row")
ok(s.upvoteWeight === 0 && s.downvoteWeight === 7 && s.independentVoters === 2, "replace a removes old up weight")

// Weight change same choice
s = apply([{ reviewerId: "x", choice: "upvote", weight: 2 }], "x", "upvote", 9)
ok(s.upvoteWeight === 9 && s.independentVoters === 1, "same choice weight replace not stack")

console.log(`\nGHPV-1A weight transitions: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
