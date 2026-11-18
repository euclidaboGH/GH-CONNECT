import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), "utf8")
const checks = [
  ["release metadata", read("lib/app-release.ts").includes(`APP_RELEASE_VERSION = "${JSON.parse(read("package.json")).version}"`)],
  ["package version", JSON.parse(read("package.json")).version === read("lib/app-release.ts").match(/APP_RELEASE_VERSION = "([^"]+)"/)?.[1]],
  ["results model", fs.existsSync(path.join(root, "lib/home-results.ts"))],
  ["results surface", fs.existsSync(path.join(root, "components/ghc/home-results-strip.tsx"))],
  ["home integration", read("components/ghc/home-command-centre.tsx").includes("HomeResultsStrip") && read("components/ghc/home-command-centre.tsx").includes("buildHomeResultMetrics")],
  ["canonical messages route", read("components/ghc/home-command-centre.tsx").includes('goTab("messages")')],
  ["canonical communities route", read("components/ghc/home-command-centre.tsx").includes('goTab("communities")')],
  ["no migration edits", !fs.existsSync(path.join(root, "scripts", "check-pass12-experience-migrations.tmp"))],
]
let failed = false
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`)
  if (!ok) failed = true
}
if (failed) process.exit(1)
console.log(`PASS ${checks.length}/${checks.length}`)
