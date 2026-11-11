import fs from "node:fs"
import path from "node:path"
const root = process.cwd()
const read = (f) => fs.readFileSync(path.join(root, f), "utf8")
const checks = [
  ["shared action language exists", fs.existsSync(path.join(root, "lib/action-language.ts"))],
  ["discovery imports shared labels", /@\/lib\/action-language/.test(read("components/ghc/discovery-object-card.tsx"))],
  ["discovery actions have accessible labels", /aria-label=\{actionAriaLabel\(/.test(read("components/ghc/discovery-object-card.tsx"))],
  ["discovery actions use comfortable touch targets", (read("components/ghc/discovery-object-card.tsx").match(/min-h-10/g) || []).length >= 4],
  ["workflow feedback remains present", fs.existsSync(path.join(root, "components/ghc/workflow-feedback.tsx"))],
  ["canonical navigation preserved", /Home.*Messages.*Communities.*Cart.*Profile/s.test(read("docs/release-0.252.0-pass30.md"))],
  ["no migration touch marker", !fs.existsSync(path.join(root, "scripts/.pass32-migration-touch"))],
  ["no financial mutation in action helper", !/balance|ledger|payment|withdraw/i.test(read("lib/action-language.ts"))],
]
let failed=0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} — ${label}`); if(!ok) failed++ }
console.log(`Pass 32 gate: ${checks.length-failed}/${checks.length}`)
if(failed) process.exit(1)
