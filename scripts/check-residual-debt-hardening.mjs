import fs from "node:fs"
import path from "node:path"

const failures = []
const apiRoot = path.resolve("app/api")
const sourceRoots = ["app", "components", "features", "lib"]

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
  }
  return out
}

for (const file of walk(apiRoot)) {
  const source = fs.readFileSync(file, "utf8")
  if (/\brequest\.json\(\)/.test(source)) failures.push(`${path.relative(process.cwd(), file)}: raw request.json() remains; use readBoundedJson`)
}

for (const root of sourceRoots) {
  for (const file of walk(path.resolve(root))) {
    const source = fs.readFileSync(file, "utf8")
    if (/window\.(confirm|prompt)\s*\(/.test(source)) failures.push(`${path.relative(process.cwd(), file)}: native confirm/prompt remains; use global interaction dialog`)
  }
}

const requiredFiles = [
  "lib/server/http/read-bounded-json.ts",
  "lib/ui/global-interactions.ts",
  "components/ghc/global-interaction-dialog.tsx",
]
for (const file of requiredFiles) if (!fs.existsSync(file)) failures.push(`${file}: required hardening component missing`)

const expected = [
  ["components/ghc/comment-sheet.tsx", "ghc:post-engagement"],
  ["components/ghc/message-screen.tsx", "useDomainEvents"],
  ["components/ghc/pending-queue-chip.tsx", "ghc:offline-queue-changed"],
  ["lib/network-resilience.ts", "ghc:offline-queue-changed"],
]
for (const [file, token] of expected) {
  const source = fs.readFileSync(file, "utf8")
  if (!source.includes(token)) failures.push(`${file}: expected event-driven replacement is missing (${token})`)
}

if (failures.length) {
  console.error(`Residual debt hardening: ${failures.length} failure(s)`)
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}
console.log("Residual debt hardening: PASS (bounded JSON, modern dialogs, and event-driven UI replacements verified)")
