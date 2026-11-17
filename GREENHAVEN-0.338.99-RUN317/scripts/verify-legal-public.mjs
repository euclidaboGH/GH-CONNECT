/**
 * Static verification: legal modules + public route prefixes present.
 * Does not start a browser; run after deploy for live Incognito checks.
 */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
let failed = 0
function ok(cond, msg) {
  if (cond) console.log("PASS", msg)
  else {
    console.error("FAIL", msg)
    failed++
  }
}

const files = [
  "lib/legal/policy-meta.ts",
  "lib/legal/privacy-policy.ts",
  "lib/legal/terms-of-service.ts",
  "lib/legal/support-content.ts",
  "components/legal-page.tsx",
  "app/privacy/page.tsx",
  "app/terms/page.tsx",
  "app/support/page.tsx",
  "components/app-wrapper.tsx",
]
for (const f of files) ok(existsSync(join(root, f)), f)

const wrapper = readFileSync(join(root, "components/app-wrapper.tsx"), "utf8")
for (const p of ["/privacy", "/terms", "/support", "/portal-setup", "/validation-key.txt"]) {
  ok(wrapper.includes(`"${p}"`), `public prefix ${p}`)
}

const privacy = readFileSync(join(root, "lib/legal/privacy-policy.ts"), "utf8")
ok(privacy.includes("GreenHaven Coin"), "privacy mentions GHC")
ok(privacy.includes("Pi Authentication"), "privacy mentions Pi auth")
ok(!privacy.includes("we guarantee absolute security"), "no absolute security claim")

const terms = readFileSync(join(root, "lib/legal/terms-of-service.ts"), "utf8")
ok(terms.includes("not an official Pi Network"), "terms independence clause")
ok(terms.includes("GHC"), "terms mention GHC")

const support = readFileSync(join(root, "lib/legal/support-content.ts"), "utf8")
ok(support.includes("passphrases"), "support warns about passphrases")

console.log(failed ? `\n${failed} failure(s)` : "\nAll legal static checks passed")
process.exit(failed ? 1 : 0)
