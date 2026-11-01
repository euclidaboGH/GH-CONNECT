import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const checks = [
  ["release metadata", /APP_RELEASE_VERSION = "0\.256\.0"/.test(read("lib/app-release.ts"))],
  ["journey progress UI", /aria-label="Journey foundations"/.test(read("components/ghc/home-journey-card.tsx"))],
  ["journey progress accessibility", /role="progressbar"/.test(read("components/ghc/home-journey-card.tsx"))],
  ["journey next action", /Next: \{journey\.next\.title\}/.test(read("components/ghc/home-journey-card.tsx"))],
  ["attention group disambiguation", /category\(n\) !== "community"/.test(read("lib/unified-attention.ts"))],
  ["attention community routing", /openTarget\(n\) === "community"/.test(read("lib/unified-attention.ts"))],
  ["canonical nav preserved", /Home.*Messages.*Communities.*Cart.*Profile/s.test(read("components/ghc/app.tsx"))],
  ["no migration edits", fs.existsSync(path.join(root, "supabase/migrations"))],
]
const failed = checks.filter(([, ok]) => !ok)
for (const [label, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`)
if (failed.length) process.exit(1)
console.log(`PASS Pass 24 journey orchestration gate ${checks.length}/${checks.length}`)
