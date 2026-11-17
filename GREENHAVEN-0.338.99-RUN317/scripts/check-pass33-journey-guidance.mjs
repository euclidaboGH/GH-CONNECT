import fs from "node:fs"
import path from "node:path"
const root = process.cwd()
const read = (name) => fs.readFileSync(path.join(root, name), "utf8")
const cards = read("components/ghc/discovery-object-card.tsx")
const paths = read("lib/workflow-paths.ts")
const checks = [
  ["journey guidance contract exists", fs.existsSync(path.join(root, "lib/workflow-paths.ts"))],
  ["journey guidance component exists", fs.existsSync(path.join(root, "components/ghc/workflow-path-hint.tsx"))],
  ["all four discovery journeys are defined", ["community", "event", "activity", "service"].every((kind) => new RegExp(`${kind}: \\[`).test(paths))],
  ["discovery cards use all four journey hints", (cards.match(/<WorkflowPathHint kind=/g) || []).length ===  4],
  ["journey guidance explicitly avoids claiming completed progress", /never represents completed user progress/.test(read("components/ghc/workflow-path-hint.tsx"))],
  ["journey steps describe conditional actions", /if available|when messaging is available|when ready/.test(paths)],
  ["canonical navigation preserved", /Home.*Messages.*Communities.*Cart.*Profile/s.test(read("docs/release-0.255.0-pass33.md"))],
  ["release versions synchronized", JSON.parse(read("package.json")).version === JSON.parse(read("package-lock.json")).version && read("lib/app-release.ts").includes(JSON.parse(read("package.json")).version)],
  ["no financial authorization logic in journey helper", !/balance|ledger|payment|withdraw|authorize/i.test(paths)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} — ${label}`); if (!ok) failed++ }
console.log(`Pass 33 gate: ${checks.length - failed}/${checks.length}`)
if (failed) process.exit(1)
