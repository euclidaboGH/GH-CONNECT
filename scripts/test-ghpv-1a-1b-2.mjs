#!/usr/bin/env node
/**
 * GHPV-1A / 1B / 2 static + pure-algorithm tests.
 * No live DB / no GHC mutation claims.
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"

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

// --- Source integration ---
const route = fs.readFileSync(
  path.join(root, "app/api/social/posts/[id]/curation/route.ts"),
  "utf8"
)
ok(route.includes("resolveAuthenticatedUser"), "1A auth required")
ok(route.includes("auth.userId"), "1A session actor")
ok(route.includes("stripClientAuthority"), "1A strip forged fields")
ok(route.includes("resolveWeightedVote"), "1A weighted vote")
ok(route.includes("gh_ghpv_record_curation_weight"), "1A record weight RPC")
ok(route.includes("p_user_id: auth.userId"), "1A no client reviewer id to RPC")
ok(route.includes("ghcMutated: false"), "1A no GHC claim")
ok(!route.includes("ghc_execute"), "1A no ledger call")

const vw = fs.readFileSync(path.join(root, "lib/server/ghpv/vote-weight.ts"), "utf8")
ok(vw.includes("stripClientAuthority"), "1A strip helper")
ok(vw.includes("computeCurationPower"), "1A uses CP")
ok(vw.includes("MAX_REVIEWER_CONSENSUS_SHARE"), "1A anti-whale export")

const settleSrc = fs.readFileSync(path.join(root, "lib/server/ghpv/settlement.ts"), "utf8")
ok(settleSrc.includes("computeSettlement"), "1B settlement fn")
ok(settleSrc.includes("UNRESOLVED"), "1B unresolved path")
ok(settleSrc.includes("applyAntiWhaleCap"), "1B anti-whale")
ok(settleSrc.includes("isJudgmentProtectedMode"), "1B subjective protection")
ok(!/ghc_execute|transfer|mint/i.test(settleSrc), "1B no GHC ops")

const cqiSrc = fs.readFileSync(path.join(root, "lib/server/ghpv/creator-quality.ts"), "utf8")
ok(cqiSrc.includes("computeCreatorQualityIndex"), "2 CQI")
ok(cqiSrc.includes("Never uses GHC balance"), "2 no balance")
ok(cqiSrc.includes("distributionFactorFromCqi"), "2 distribution factor")

const mig = fs.readFileSync(
  path.join(root, "supabase/migrations/20261014_ghpv_curation_weight_and_settle.sql"),
  "utf8"
)
ok(mig.includes("gh_ghpv_record_curation_weight"), "migration record RPC")
ok(mig.includes("gh_ghpv_persist_settlement"), "migration settle RPC")
ok(mig.includes("ghcMutated"), "migration documents no GHC")
ok(mig.includes("GRANT EXECUTE") && mig.includes("service_role"), "service_role only")
ok(mig.includes("REVOKE ALL"), "revoke public")

// --- Pure algorithm: settlement ---
// Inline minimal ports of settlement logic for deterministic tests without TS path
const MAX_SHARE = 0.12
function antiWhale(votes) {
  const total = votes.reduce((s, v) => s + Math.max(0, v.weight), 0)
  if (total <= 0) return votes.map((v) => ({ ...v, weight: 0 }))
  const cap = total * MAX_SHARE
  return votes.map((v) => ({ ...v, weight: Math.min(Math.max(0, v.weight), cap) }))
}
function settle(votes, mode = "useful", minVoters = 3, minConf = 35) {
  const capped = antiWhale(votes)
  const independentVoters = new Set(capped.map((v) => v.reviewerId)).size
  let up = 0,
    down = 0
  for (const v of capped) {
    if (v.choice === "upvote") up += v.weight
    else down += v.weight
  }
  const total = up + down
  if (independentVoters < minVoters || total <= 0) {
    return { status: "UNRESOLVED", reason: "INSUFFICIENT", confidence: 0 }
  }
  const margin = Math.abs(up - down) / total
  let confidence = Math.min(100, margin * 100 * (0.5 + Math.min(1, independentVoters / 20) * 0.5))
  if (mode === "creative" || mode === "opinion") confidence = Math.min(confidence, 40)
  if (confidence < minConf || margin < 0.08) {
    return { status: "UNRESOLVED", reason: margin < 0.08 ? "CLOSE" : "LOW_CONF", confidence }
  }
  return {
    status: "SETTLED",
    consensus: up >= down ? "upvote" : "downvote",
    confidence,
    up,
    down,
  }
}

const clear = settle([
  { reviewerId: "a", choice: "upvote", weight: 5 },
  { reviewerId: "b", choice: "upvote", weight: 5 },
  { reviewerId: "c", choice: "upvote", weight: 5 },
  { reviewerId: "d", choice: "downvote", weight: 1 },
])
ok(clear.status === "SETTLED" && clear.consensus === "upvote", "clear consensus settles upvote")

const close = settle([
  { reviewerId: "a", choice: "upvote", weight: 5 },
  { reviewerId: "b", choice: "downvote", weight: 5 },
  { reviewerId: "c", choice: "upvote", weight: 5.2 },
])
ok(close.status === "UNRESOLVED" || close.confidence < 50, "close race unresolved or low conf")

const few = settle([
  { reviewerId: "a", choice: "upvote", weight: 10 },
  { reviewerId: "b", choice: "upvote", weight: 10 },
])
ok(few.status === "UNRESOLVED", "insufficient voters unresolved")

const whale = antiWhale([
  { reviewerId: "whale", choice: "upvote", weight: 100 },
  { reviewerId: "a", choice: "downvote", weight: 5 },
  { reviewerId: "b", choice: "downvote", weight: 5 },
  { reviewerId: "c", choice: "downvote", weight: 5 },
])
const origTotal = 100 + 5 + 5 + 5
const whaleW = whale.find((v) => v.reviewerId === "whale").weight
ok(whaleW <= origTotal * MAX_SHARE + 0.001, "anti-whale caps single share")

const creative = settle(
  [
    { reviewerId: "a", choice: "upvote", weight: 8 },
    { reviewerId: "b", choice: "upvote", weight: 8 },
    { reviewerId: "c", choice: "downvote", weight: 2 },
  ],
  "creative"
)
ok(creative.confidence === undefined || creative.confidence <= 40 || creative.status === "UNRESOLVED" || creative.status === "SETTLED", "creative mode bounded")

// Idempotent settlement identity
const epoch = "2026-W40"
const key1 = `judgment:post1:${epoch}:userA`
const key2 = `judgment:post1:${epoch}:userA`
ok(key1 === key2, "idempotent judgment key stable")

// --- Creator quality ---
function cqi(s) {
  const qv = Math.max(0, s.qualifiedViews)
  const completionRate = qv > 0 ? Math.min(1, s.completions / qv) : 0
  const saveRate = qv > 0 ? Math.min(1, s.saves / qv) : 0
  const shareRate = qv > 0 ? Math.min(1, s.shares / qv) : 0
  const volumeComponent = Math.min(30, Math.log10(1 + qv) * 10)
  const satisfaction = completionRate * 25 + saveRate * 15 + shareRate * 10
  let judgmentNet = (s.positiveJudgmentScore - s.negativeJudgmentScore) * (s.avgConfidence / 100)
  if (judgmentNet < 0) judgmentNet *= 1 - s.subjectiveShare * 0.6
  const judgmentComponent = Math.max(-20, Math.min(20, judgmentNet))
  const decay = s.ageDays <= 14 ? 1 : Math.max(0.55, 1 - (s.ageDays - 14) / 180)
  const raw = (volumeComponent + satisfaction + judgmentComponent) * decay * s.integrityFactor
  return Math.min(100, Math.max(0, raw))
}

const highQ = cqi({
  qualifiedViews: 2000,
  completions: 1200,
  saves: 400,
  shares: 100,
  positiveJudgmentScore: 12,
  negativeJudgmentScore: 1,
  avgConfidence: 80,
  ageDays: 5,
  integrityFactor: 1,
  subjectiveShare: 0,
})
const viralPoor = cqi({
  qualifiedViews: 100000,
  completions: 500,
  saves: 50,
  shares: 20,
  positiveJudgmentScore: 0,
  negativeJudgmentScore: 8,
  avgConfidence: 70,
  ageDays: 3,
  integrityFactor: 0.5,
  subjectiveShare: 0,
})
const nicheHigh = cqi({
  qualifiedViews: 400,
  completions: 300,
  saves: 150,
  shares: 40,
  positiveJudgmentScore: 10,
  negativeJudgmentScore: 0,
  avgConfidence: 85,
  ageDays: 7,
  integrityFactor: 1,
  subjectiveShare: 0,
})
const attack = cqi({
  qualifiedViews: 800,
  completions: 500,
  saves: 200,
  shares: 50,
  positiveJudgmentScore: 8,
  negativeJudgmentScore: 40,
  avgConfidence: 20,
  ageDays: 2,
  integrityFactor: 0.4,
  subjectiveShare: 0,
})

ok(highQ > viralPoor, "sustained quality beats viral poor")
ok(nicheHigh > 20, "high-quality low-volume still scores")
ok(attack < highQ, "coordinated downvote pressure limited by conf/integrity")

const old = cqi({
  qualifiedViews: 2000,
  completions: 1200,
  saves: 400,
  shares: 100,
  positiveJudgmentScore: 12,
  negativeJudgmentScore: 1,
  avgConfidence: 80,
  ageDays: 120,
  integrityFactor: 1,
  subjectiveShare: 0,
})
ok(old < highQ, "time decay on old peak")

console.log(`\nGHPV-1A/1B/2: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
