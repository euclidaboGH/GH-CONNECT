import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let p = 0
let f = 0
const assert = (c, m) => {
  if (c) {
    p++
    console.log("  ✓", m)
  } else {
    f++
    console.error("  ✗", m)
  }
}

console.log("\n=== BUILD REPAIR #50.1 ===\n")

const communities = readFileSync(join(root, "components/ghc/communities-screen.tsx"), "utf8")
assert(communities.includes("<CommunityJoinReasonPicker"), "picker present")
assert(
  /CommunityJoinReasonPicker[\s\S]*?\/>\s*\n\s*<\/div>\s*\n\s*\)/.test(communities),
  "picker inside root before </div>"
)

const discovery = readFileSync(join(root, "components/ghc/discovery-grid-screen.tsx"), "utf8")
assert(discovery.includes("<ConnectionIntentPicker"), "discovery picker present")
assert(
  /ConnectionIntentPicker[\s\S]*?\/>\s*\n\s*<\/div>\s*\n\s*\)/.test(discovery),
  "discovery picker inside root"
)
assert(
  discovery.split('from "@/lib/connection-intents"').length - 1 === 1,
  "single connection-intents import"
)

const rel = readFileSync(join(root, "components/ghc/relationship-actions.tsx"), "utf8")
assert(
  /ConnectionIntentPicker[\s\S]*?\/>\s*\n\s*<\/div>\s*\n\s*\)/.test(rel),
  "relationship picker inside root"
)

const idx = readFileSync(join(root, "lib/domains/index.ts"), "utf8")
assert(
  (idx.match(/sendUnifiedConnectionRequest/g) || []).length === 1,
  "single sendUnified export name"
)
assert(idx.includes("listPendingConnectionRequests"), "pending helpers exported")

const a2u = readFileSync(join(root, "app/api/payments/a2u/create/route.ts"), "utf8")
assert(
  a2u.includes("status: 503") && a2u.includes("PI_API_KEY not configured"),
  "a2u 503 block complete"
)
assert(
  a2u.includes("GHC_A2U_ADMIN_KEY") && a2u.includes("status: 403"),
  "a2u admin gate intact"
)

const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"))
assert(
  typeof vercel.installCommand === "string" &&
    vercel.installCommand.includes("legacy-peer-deps"),
  "vercel install uses legacy-peer-deps"
)

const hasLock = existsSync(join(root, "package-lock.json"))
console.log(
  hasLock
    ? "  · package-lock.json present"
    : "  · package-lock.json MISSING — run npm install --legacy-peer-deps on your machine"
)

console.log("\nPassed:", p, "Failed:", f)
if (f) process.exit(1)
console.log("ALL BUILD REPAIR CHECKS PASSED\n")
