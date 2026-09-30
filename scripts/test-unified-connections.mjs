import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed=0,failed=0
const assert=(c,m)=>{if(c){passed++;console.log("  ✓",m)}else{failed++;console.error("  ✗",m)}}
console.log("\n=== UNIFIED CONNECTIONS (#40) ===\n")
const files=[
  "lib/domains/adapters/unified-connection-request.ts",
  "lib/domains/adapters/connection-notification-actions.ts",
  "lib/domains/contracts/introductions.ts",
  "components/ghc/relationship-actions.tsx",
  "components/ghc/discovery-grid-screen.tsx",
  "app/api/connections/request/route.ts",
]
for (const f of files) assert(existsSync(join(root,f)),`exists ${f}`)
const u=readFileSync(join(root,"lib/domains/adapters/unified-connection-request.ts"),"utf8")
assert(u.includes("sendUnifiedConnectionRequest")&&u.includes("acceptUnifiedConnectionRequest"),"send/accept")
assert(u.includes("listPendingConnectionRequests"),"pending list")
assert(u.includes("validateConnectionIntents"),"intent validation")
assert(u.includes("getUnifiedConnectionState"),"state normalization")
assert(u.includes("TARGET_BLOCKED")&&u.includes("ALREADY_CONNECTED"),"guard codes")
assert(u.includes("outgoing_pending")&&u.includes("incoming_pending"),"pending states")
assert(u.includes("session+server")||u.includes("server_unavailable"),"dual-path")
const rel=readFileSync(join(root,"components/ghc/relationship-actions.tsx"),"utf8")
assert((rel.includes("sendUnifiedConnectionRequest")||rel.includes("submitConnectionFromPicker"))&&rel.includes("acceptUnifiedConnectionRequest"),"profile uses unified")
const grid=readFileSync(join(root,"components/ghc/discovery-grid-screen.tsx"),"utf8")
assert(grid.includes("sendUnifiedConnectionRequest"),"discover send")
assert(grid.includes("acceptUnifiedConnectionRequest"),"discover accept")
const api=readFileSync(join(root,"app/api/connections/request/route.ts"),"utf8")
assert(api.includes("validateConnectionIntents")||api.includes("UNAUTHORIZED"),"api auth/validate")
assert(api.includes("resolveAuthenticatedUser"),"server auth")
const intro=readFileSync(join(root,"lib/domains/contracts/introductions.ts"),"utf8")
assert(intro.includes("IntroductionRequest")&&intro.includes("INTRODUCTIONS_NOT_IMPLEMENTED"),"intro foundation")
const notif=readFileSync(join(root,"lib/domains/adapters/connection-notification-actions.ts"),"utf8")
assert(notif.includes("acceptFromNotification")&&notif.includes("connectFromSearch"),"notif+search helpers")
for (const f of ["lib/domains/adapters/unified-connection-request.ts","app/api/connections/request/route.ts"]) {
  const t=readFileSync(join(root,f),"utf8")
  assert(!t.includes("executeAuthoritativeSpend")&&!t.includes("PI_API_KEY"),f+" financial isolation")
}
const econ=readFileSync(join(root,"lib/server/economy/economic-config.ts"),"utf8")
assert(econ.includes("VIP_PRICE_GHC = 150"),"VIP unchanged")
console.log("\n=== RESULTS ===\nPassed:",passed,"\nFailed:",failed)
if(failed) process.exit(1)
console.log("ALL #40 TESTS PASSED\n")
