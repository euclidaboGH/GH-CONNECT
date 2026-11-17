import { readFileSync } from "node:fs"
const ignore = readFileSync(".vercelignore", "utf8")
const config = JSON.parse(readFileSync("vercel.json", "utf8"))
const prepare = readFileSync("scripts/prepare-vercel-build.mjs", "utf8")
const required = [".git", "node_modules", ".next", ".cache", ".turbo", ".vercel", "coverage", "playwright-report", "test-results", "*.tsbuildinfo", "*.zip", ".env*"]
let failed = 0
for (const pattern of required) {
  const ok = ignore.split(/\r?\n/).some((line) => line.trim() === pattern)
  console.log(`${ok ? "PASS" : "FAIL"} Vercel upload excludes ${pattern}`)
  if (!ok) failed += 1
}
const build = String(config.buildCommand || "")
const install = String(config.installCommand || "")
const checks = [
  ["Vercel build clears stale Webpack cache before Next build", build.includes("scripts/prepare-vercel-build.mjs")],
  ["Vercel install recreates dependencies from lockfile", /npm ci/.test(install)],
  ["cache cleanup is contained inside project root", prepare.includes("target.startsWith(`${root}${sep}`)")],
  ["cache cleanup refuses symlinked cache path", prepare.includes("isSymbolicLink()")],
  ["cache cleanup only targets Webpack build cache", prepare.includes('".next", "cache", "webpack"')],
]
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failed += 1 }
console.log(`Vercel build hygiene: ${required.length + checks.length - failed}/${required.length + checks.length} passed`)
process.exit(failed ? 1 : 0)
