#!/usr/bin/env node
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

const doc = fs.readFileSync(path.join(root, "docs/GHPV_PROOF_OF_VALUE_FRAMEWORK.md"), "utf8")
ok(doc.includes("GHC balance does **not** grant vote weight"), "doctrine: no balance→power")
ok(doc.includes("A vote is **not** a GHC minting event"), "doctrine: no vote mint")
ok(doc.includes("GHPV-1"), "phased plan present")

const mig = fs.readFileSync(
  path.join(root, "supabase/migrations/20261013_ghpv_judgment_infrastructure.sql"),
  "utf8"
)
ok(mig.includes("gh_content_quality_state"), "quality state table")
ok(mig.includes("gh_curator_calibration"), "calibration table")
ok(mig.includes("gh_judgment_settlements"), "settlements table")
ok(mig.includes("gh_judgment_events"), "judgment events table")
ok(mig.includes("USING (false)"), "RLS deny client")
ok(!/ghc_execute|INSERT INTO public\.ghc_transactions/i.test(mig), "no GHC mutation in GHPV-1 migration")

const cp = fs.readFileSync(path.join(root, "lib/server/ghpv/curation-power.ts"), "utf8")
ok(cp.includes("GHC balance is intentionally excluded"), "CP excludes GHC")
ok(cp.includes("MAX_REVIEWER_CONSENSUS_SHARE"), "anti-whale share")
ok(cp.includes("computeCurationPower"), "CP function")

// Pure formula smoke (inline)
function clamp01to100(n) {
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, n))
}
function compute(input) {
  const level = Math.min(15, Math.max(1, Math.floor(input.reputationLevel) || 1))
  const jcs = clamp01to100(input.judgmentCalibration)
  const integrity = clamp01to100(input.integrityScore)
  const maturity = Math.min(1, Math.max(0, input.accountAgeDays) / 180)
  const independence = Math.min(1, Math.max(0, input.independenceFactor))
  const antiAbuse = Math.min(1, Math.max(0, input.antiAbuseFactor))
  const levelFactor = 0.35 + (level / 15) * 0.65
  const jcsFactor = 0.4 + (jcs / 100) * 0.6
  const integrityFactor = 0.5 + (integrity / 100) * 0.5
  const maturityFactor = 0.55 + maturity * 0.45
  const raw =
    levelFactor *
    jcsFactor *
    integrityFactor *
    maturityFactor *
    (0.5 + independence * 0.5) *
    antiAbuse
  return Math.min(25, Math.max(0.25, raw * 8))
}
const low = compute({
  reputationLevel: 1,
  judgmentCalibration: 50,
  integrityScore: 70,
  accountAgeDays: 1,
  independenceFactor: 1,
  antiAbuseFactor: 1,
})
const high = compute({
  reputationLevel: 14,
  judgmentCalibration: 95,
  integrityScore: 95,
  accountAgeDays: 400,
  independenceFactor: 1,
  antiAbuseFactor: 1,
})
ok(high > low, "higher trust yields higher CP")
ok(low >= 0.25 && high <= 25, "CP bounded")

console.log(`\nGHPV foundation: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
