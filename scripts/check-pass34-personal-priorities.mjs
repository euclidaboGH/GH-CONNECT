import fs from "node:fs"
import path from "node:path"
const root = process.cwd()
const component = fs.readFileSync(path.join(root, "components/ghc/home-cross-feature-path.tsx"), "utf8")
const helper = fs.readFileSync(path.join(root, "lib/home-priority-groups.ts"), "utf8")
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"))
const release = fs.readFileSync(path.join(root, "lib/app-release.ts"), "utf8")
const migrationFiles = []
function walk(dir) { for (const item of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, item.name); if (item.isDirectory()) walk(full); else if (/\.sql$/i.test(item.name) && /migration/i.test(full)) migrationFiles.push(path.relative(root, full)) } }
walk(path.join(root, "supabase/migrations"))
const manifest = fs.readFileSync(path.join(root, "MIGRATION-SOURCE-MANIFEST.csv"), "utf8")
const checks = [
  ["four evidence-backed priority groups defined", ["respond", "participate", "build", "manage"].every((v) => helper.includes(`id: "${v}"`))],
  ["priority groups consume existing signals only", /signals\.filter\(\(signal\) => kinds\.includes\(signal\.kind\)\)/.test(helper)],
  ["Home renders grouped personal priorities", /groupHomePriorities\(preparedSignals\.slice\(1, 7\)\)/.test(component)],
  ["priority actions retain accessible labels", /aria-label=\{`\$\{signal\.cta\}: \$\{signal\.title\}`\}/.test(component)],
  ["responsive priority layout is present", /grid-cols-1.*sm:grid-cols-2/.test(component)],
  ["no fake counts or synthetic signals", !/Math\.random|mock|demo|fake/i.test(helper)],
  ["release package and lock synchronized", pkg.version === lock.version && lock.packages?.[""]?.version === pkg.version],
  ["release metadata synchronized", release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ["migration manifest retained", manifest.trim().length > 0 && migrationFiles.length >= 170],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} — ${label}`); if (!ok) failed++ }
console.log(`Pass 34 gate: ${checks.length - failed}/${checks.length}`)
if (failed) process.exit(1)
