#!/usr/bin/env node
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
let pass = 0, fail = 0
function ok(c, m) { if (c) { pass++; console.log("  ✓", m) } else { fail++; console.log("  ✗", m) } }

const src = fs.readFileSync(path.join(root, "lib/server/ghpv/calibration.ts"), "utf8")
ok(src.includes("MIN_SAMPLES_FOR_STRONG_CALIBRATION"), "min sample size")
ok(src.includes("MAX_JCS_DELTA_PER_EVENT"), "per-event bound")
ok(src.includes("MAX_JCS_DELTA_PER_DAY"), "daily cap")
ok(src.includes("EARLY_VOTE"), "early-vote dampening")
ok(src.includes("COORDINATION_SUSPECT"), "ring protection")
ok(src.includes("SELF_OR_ALT"), "self/alt protection")
ok(src.includes("PROTECTED_MODE"), "subjective protection")
ok(!/ghc_execute|mint|transfer|wallet/i.test(src), "no GHC in calibration module")

const mig = fs.readFileSync(path.join(root, "supabase/migrations/20261015_ghpv_curator_calibration_apply.sql"), "utf8")
ok(mig.includes("gh_ghpv_apply_calibration"), "apply RPC")
ok(mig.includes("ghcMutated"), "explicit no GHC")
ok(mig.includes("service_role") && mig.includes("REVOKE ALL"), "service_role only")

// Pure calibration logic (mirror)
const DEFAULT_JCS = 50
const MAX_EVENT = 2.5
const MAX_DAY = 6
const MIN_SAMPLES = 5

function clamp(n, a, b) { return Math.min(b, Math.max(a, n)) }
function apply(state, { alignment, confidence, settled, early, coord, self, wasDownvote }) {
  if (self) return { jcs: state.jcs, skipped: "SELF" }
  if (coord) return { jcs: state.jcs, skipped: "COORD" }
  if (!settled || alignment === "unresolved") return { jcs: state.jcs, skipped: "UNRESOLVED" }
  if (alignment === "protected") return { jcs: state.jcs, skipped: "PROTECTED" }
  let delta = alignment === "aligned" ? 0.4 + (confidence/100)*1.6 : (wasDownvote ? -2.2 : -1.4) * (0.3 + (confidence/100)*0.7)
  if (state.sampleCount < MIN_SAMPLES) delta *= 0.35
  if (alignment === "misaligned" && confidence < 50) delta *= 0.5
  if (early) delta *= 0.5
  delta = clamp(delta, -MAX_EVENT, MAX_EVENT)
  const room = MAX_DAY - (state.dayDeltaAbs || 0)
  if (room <= 0) return { jcs: state.jcs, skipped: "DAILY_CAP" }
  if (Math.abs(delta) > room) delta = delta > 0 ? room : -room
  return { jcs: clamp(state.jcs + delta, 0, 100), delta, skipped: null }
}

let accurate = { jcs: 50, sampleCount: 10, dayDeltaAbs: 0 }
for (let i = 0; i < 8; i++) {
  const r = apply(accurate, { alignment: "aligned", confidence: 80, settled: true, wasDownvote: false })
  accurate = { jcs: r.jcs, sampleCount: accurate.sampleCount + 1, dayDeltaAbs: (accurate.dayDeltaAbs || 0) + Math.abs(r.delta || 0) }
}
ok(accurate.jcs > 50, "accurate reviewer gains JCS")

let bad = { jcs: 50, sampleCount: 10, dayDeltaAbs: 0 }
for (let i = 0; i < 8; i++) {
  const r = apply(bad, { alignment: "misaligned", confidence: 80, settled: true, wasDownvote: true })
  bad = { jcs: r.jcs, sampleCount: bad.sampleCount + 1, dayDeltaAbs: (bad.dayDeltaAbs || 0) + Math.abs(r.delta || 0) }
}
ok(bad.jcs < 50, "inaccurate reviewer loses JCS gradually")

const oneOff = apply({ jcs: 50, sampleCount: 10, dayDeltaAbs: 0 }, {
  alignment: "misaligned", confidence: 40, settled: true, wasDownvote: false
})
ok(Math.abs(oneOff.delta) < 2, "one-off disagreement mild")

const newbie = apply({ jcs: 50, sampleCount: 1, dayDeltaAbs: 0 }, {
  alignment: "aligned", confidence: 90, settled: true, wasDownvote: false
})
const veteran = apply({ jcs: 50, sampleCount: 20, dayDeltaAbs: 0 }, {
  alignment: "aligned", confidence: 90, settled: true, wasDownvote: false
})
ok(Math.abs(newbie.delta) < Math.abs(veteran.delta), "new reviewer dampened")

const unresolved = apply({ jcs: 50, sampleCount: 5, dayDeltaAbs: 0 }, {
  alignment: "unresolved", confidence: 10, settled: false, wasDownvote: false
})
ok(unresolved.skipped === "UNRESOLVED", "unresolved no JCS change")

const coord = apply({ jcs: 50, sampleCount: 5, dayDeltaAbs: 0 }, {
  alignment: "aligned", confidence: 90, settled: true, coord: true, wasDownvote: false
})
ok(coord.skipped === "COORD", "coordinated voting skipped for JCS gain")

// Daily cap cannot destroy
let capped = { jcs: 50, sampleCount: 20, dayDeltaAbs: 0 }
for (let i = 0; i < 20; i++) {
  const r = apply(capped, { alignment: "misaligned", confidence: 90, settled: true, wasDownvote: true })
  if (r.skipped === "DAILY_CAP") break
  capped = { jcs: r.jcs, sampleCount: capped.sampleCount + 1, dayDeltaAbs: (capped.dayDeltaAbs || 0) + Math.abs(r.delta || 0) }
}
ok(capped.jcs >= 50 - MAX_DAY - 0.1, "daily cap prevents destruction")

console.log(`\nGHPV-3 calibration: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
