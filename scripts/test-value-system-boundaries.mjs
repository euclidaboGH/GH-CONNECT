/**
 * Static value-system boundary tests (no live DB).
 * Ensures reactions/curation fail closed in production when DB missing,
 * and documents concept separation / no GHC from GHPV paths.
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
let pass = 0
let fail = 0

function ok(name, cond, detail = "") {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.error(`  ✗ ${name}${detail ? " — " + detail : ""}`)
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8")
}

console.log("Value system boundaries\n")

const reactions = read("app/api/social/posts/[id]/reactions/route.ts")
const curation = read("app/api/social/posts/[id]/curation/route.ts")
const cp = read("lib/server/ghpv/curation-power.ts")
const vote = read("lib/server/ghpv/vote-weight.ts")
const tips = read("app/api/social/tips/route.ts")
const repCfg = read("lib/server/reputation/config.ts")
const guard = read("lib/server/production-guard.ts")

ok("production-guard defines isProductionRuntime", /isProductionRuntime/.test(guard))
ok("reactions uses nonDurableWriteResponse", /nonDurableWriteResponse/.test(reactions))
ok(
  "reactions does not ok:true on missing DB without guard",
  !/socialDbConfigured\(\)\s*\{\s*return NextResponse\.json\(\{\s*ok:\s*true,\s*durable:\s*false/.test(
    reactions
  )
)
ok("curation uses nonDurableWriteResponse", /nonDurableWriteResponse/.test(curation))
ok(
  "curation does not fail-open on missing DB",
  !/socialDbConfigured\(\)\s*\{\s*return NextResponse\.json\(\{\s*ok:\s*true,\s*durable:\s*false/.test(
    curation
  )
)
ok("curation power excludes GHC balance", /GHC balance is intentionally excluded|Never uses wallet\/GHC/.test(cp))
ok("resolveWeightedVote loads reputation from server store", /getReputationState/.test(vote))
ok("stripClientAuthority used on curation path", /stripClientAuthority/.test(curation) || /stripClientAuthority/.test(vote))
ok("tips mark settlement deferred", /settlement.*deferred|completed:\s*false/i.test(tips))
ok("tips forbid self tip", /SELF_TIP_FORBIDDEN/.test(tips))
ok("reputation catalog has fixed points", /REPUTATION_EVENT_POINTS/.test(repCfg))
ok(
  "votes/curation not in public reputation events",
  !/upvote|downvote|curation_vote|reaction_like/.test(repCfg)
)

// GHPV modules must not call ghc_execute
const ghpvDir = path.join(root, "lib/server/ghpv")
for (const f of fs.readdirSync(ghpvDir).filter((x) => x.endsWith(".ts"))) {
  const body = fs.readFileSync(path.join(ghpvDir, f), "utf8")
  ok(
    `GHPV ${f} has no ghc_execute`,
    !/ghc_execute_/.test(body),
    "found ghc_execute"
  )
}

const settle = read("app/api/social/posts/[id]/ghpv/settle/route.ts")
ok("settlement requires internal key", /GH_SETTLEMENT_INTERNAL_KEY/.test(settle))
ok("settlement uses timingSafeEqual", /timingSafeEqual/.test(settle))

console.log(`\nValue system boundaries: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
