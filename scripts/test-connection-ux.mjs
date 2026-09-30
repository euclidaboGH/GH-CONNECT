import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
let passed=0,failed=0
const assert=(c,m)=>{if(c){passed++;console.log("  ✓",m)}else{failed++;console.error("  ✗",m)}}
console.log("\n=== CONNECTION UX (#42) ===\n")
const files=[
  "components/ghc/connection-intent-picker.tsx",
  "lib/domains/adapters/connection-connect-flow.ts",
  "components/ghc/discovery-grid-screen.tsx",
  "components/ghc/match-screen.tsx",
  "components/ghc/relationship-actions.tsx",
  "components/ghc/app.tsx",
]
for (const f of files) assert(existsSync(join(root,f)),`exists ${f}`)
const picker=readFileSync(join(root,"components/ghc/connection-intent-picker.tsx"),"utf8")
assert(picker.includes('role="dialog"')&&picker.includes("aria-modal"),"dialog a11y")
assert(picker.includes("Escape")&&picker.includes("What would you like to connect about"),"copy+escape")
assert(picker.includes("friendship")&&picker.includes("professional")&&picker.includes("collaboration"),"intents")
assert(picker.includes("does not guarantee acceptance"),"no guarantee language")
const flow=readFileSync(join(root,"lib/domains/adapters/connection-connect-flow.ts"),"utf8")
assert(flow.includes("submitConnectionFromPicker")&&flow.includes("userFacingConnectError"),"flow helpers")
assert(flow.includes("incomingRequestBadgeCount")&&flow.includes("primaryConnectionCta"),"badge+cta")
const disc=readFileSync(join(root,"components/ghc/discovery-grid-screen.tsx"),"utf8")
assert(disc.includes("ConnectionIntentPicker")&&disc.includes("confirmConnect"),"discover picker flow")
assert(disc.includes("setPickerTarget")&&!disc.slice(disc.indexOf("const onConnect"),disc.indexOf("const onPass")).includes("sendUnifiedConnectionRequest"),"discover connect opens picker only")
const ms=readFileSync(join(root,"components/ghc/match-screen.tsx"),"utf8")
assert(ms.includes("ConnectionIntentPicker")&&ms.includes("confirmMatchConnect"),"match picker")
const rel=readFileSync(join(root,"components/ghc/relationship-actions.tsx"),"utf8")
assert(rel.includes("ConnectionIntentPicker")&&rel.includes("Pending"),"profile picker+pending")
assert(rel.includes("disabled={!!busy || state.isFriend || state.outgoingRequest}"),"no duplicate request")
const app=readFileSync(join(root,"components/ghc/app.tsx"),"utf8")
assert(app.includes("connectionRequestBadge")&&app.includes("incomingRequestBadgeCount"),"nav badge")
const inbox=readFileSync(join(root,"components/ghc/connection-request-inbox.tsx"),"utf8")
assert(inbox.includes("Accept")&&inbox.includes("Decline")&&!inbox.includes("Cancel request"),"inbox no fake cancel")
for (const f of ["lib/domains/adapters/connection-connect-flow.ts","components/ghc/connection-intent-picker.tsx"]) {
  const x=readFileSync(join(root,f),"utf8")
  assert(!x.includes("PI_API_KEY")&&!x.includes("executeAuthoritativeSpend"),f+" financial isolation")
}
const econ=readFileSync(join(root,"lib/server/economy/economic-config.ts"),"utf8")
assert(econ.includes("VIP_PRICE_GHC = 150"),"VIP unchanged")
console.log("\n=== RESULTS ===\nPassed:",passed,"\nFailed:",failed)
if(failed) process.exit(1)
console.log("ALL #42 TESTS PASSED\n")
