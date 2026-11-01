import fs from "node:fs"
import path from "node:path"
const root = process.cwd()
const helper = fs.readFileSync(path.join(root, "lib/settings-search.ts"), "utf8")
const settings = fs.readFileSync(path.join(root, "components/ghc/settings.tsx"), "utf8")
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"))
const release = fs.readFileSync(path.join(root, "lib/app-release.ts"), "utf8")
const migrations = fs.readdirSync(path.join(root, "supabase/migrations")).filter((name) => name.endsWith(".sql"))
const checks = [
  ["multi-word settings query tokenization", helper.includes(".split(/\\s+/)")],
  ["all query tokens must match", /tokens\.every/.test(helper)],
  ["title matches rank above metadata", /title\.includes\(token\) \? 5/.test(helper)],
  ["search is integrated into Settings", /matchSettingsSearch\(settingsQuery, item\)/.test(settings)],
  ["accessible live result count", /aria-live=\"polite\"/.test(settings) && /settingsResultCount/.test(settings)],
  ["one-tap search reset is accessible", /Clear settings search/.test(settings)],
  ["empty query retains all settings", /if \(!tokens\.length\) return 1/.test(helper)],
  ["release package and lock synchronized", pkg.version === lock.version && lock.packages?.[""]?.version === pkg.version],
  ["release metadata synchronized", release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ["no migration files changed in release inventory", migrations.length === 170],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} — ${label}`); if (!ok) failed++ }
console.log(`Pass 35 gate: ${checks.length - failed}/${checks.length}`)
if (failed) process.exit(1)
