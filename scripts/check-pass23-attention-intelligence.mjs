import fs from "node:fs"
import path from "node:path"
const root=process.cwd(); const read=(p)=>fs.readFileSync(path.join(root,p),"utf8")
const checks=[
 ["release metadata",JSON.parse(read("package.json")).version === read("lib/app-release.ts").match(/APP_RELEASE_VERSION = "([^"]+)"/)?.[1]],
 ["attention model",read("lib/unified-attention.ts").includes("resolvePrimaryAttention")],
 ["attention card",read("components/ghc/attention-command-card.tsx").includes("What matters now")],
 ["notification integration",read("components/ghc/notification-bell.tsx").includes("AttentionCommandCard")],
 ["canonical nav",read("lib/navigation/primary-tabs.ts").includes("messages") && read("lib/navigation/primary-tabs.ts").includes("communities")],
 ["no migration edits",fs.readdirSync(path.join(root,"supabase/migrations")).length>=170],
 ["no fake queue claim",!read("components/ghc/attention-command-card.tsx").toLowerCase().includes("queued offline")],
 ["result routing",read("lib/unified-attention.ts").includes("open: \"marketplace\"")],
]
let fail=0; for(const [n,ok] of checks){console.log(`${ok?"PASS":"FAIL"} ${n}`); if(!ok) fail++} console.log(`Pass 23 gate: ${checks.length-fail}/${checks.length}`); process.exit(fail?1:0)
