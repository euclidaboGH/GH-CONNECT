#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
const root = join(fileURLToPath(new URL("..", import.meta.url)))
const prompt = readFileSync(join(root, "components/ghc/daily-claim-prompt.tsx"), "utf8")
const attention = readFileSync(join(root, "lib/social/attention.ts"), "utf8")
const input = readFileSync(join(root, "components/ghc/message-components.tsx"), "utf8")
const checks = [
  ["daily claim has no automatic open behavior", !/autoOpenKey|Auto-open claim sheet|setOpen\(true\).*serverClaimable/s.test(prompt)],
  ["daily claim sheet is opened by the visible lightning/coin click", /onClick=\{\(\) => \{[\s\S]*?setOpen\(true\)/.test(prompt)],
  ["daily claim has no global event listener that can open it behind the user's back", !/addEventListener\(\"ghc:open-daily-claim\"/.test(prompt)],
  ["post view and qualified-view counts deduplicate per user/post for lifetime", /eventType === \"complete\" \|\| eventType === \"view\" \|\| eventType === \"qualified_view\"\) return \"once\"/.test(attention)],
  ["message composer hides bottom navigation while focused", /onFocus=\{\(\) => \{[\s\S]*?ghc:bottom-nav-visibility[\s\S]*?hidden: true/.test(input)],
  ["message composer restores bottom navigation on blur", /onBlur=\{\(\) => \{[\s\S]*?ghc:bottom-nav-visibility[\s\S]*?hidden: false/.test(input)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failed++ }
if (failed) process.exit(1)
console.log(`UX regression checks: ${checks.length - failed}/${checks.length} passed.`)
