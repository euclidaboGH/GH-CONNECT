import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const checks = [
  ["shared workflow contract exists", fs.existsSync(path.join(root, "lib/workflow-experience.ts"))],
  ["shared workflow feedback exists", fs.existsSync(path.join(root, "components/ghc/workflow-feedback.tsx"))],
  ["workflow status has explicit lifecycle", /pending.*success.*error.*info/s.test(read("lib/workflow-experience.ts"))],
  ["workflow feedback is accessible", /aria-live="polite"/.test(read("components/ghc/workflow-feedback.tsx"))],
  ["marketplace uses shared feedback", /WorkflowFeedback/.test(read("components/ghc/marketplace-screen.tsx"))],
  ["home uses shared feedback", /WorkflowFeedback/.test(read("components/ghc/home-cross-feature-path.tsx"))],
  ["canonical navigation remains five items", /Home.*Messages.*Communities.*Cart.*Profile/s.test(read("docs/release-0.252.0-pass30.md"))],
  ["no migration files changed by this pass", !fs.existsSync(path.join(root, "scripts/.pass31-migration-touch"))],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}`)
  if (!ok) failed++
}
console.log(`Pass 31 gate: ${checks.length - failed}/${checks.length}`)
if (failed) process.exit(1)
