#!/usr/bin/env node
/**
 * Phase 3 — GitHub Actions reference hygiene.
 * Requires major/minor tags (not @main/@master). Full SHA pinning is preferred
 * and reported as a warning when only floating tags are used.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const wfDir = join(root, ".github/workflows")
if (!existsSync(wfDir)) {
  console.log("PASS no workflows directory")
  process.exit(0)
}

const files = readdirSync(wfDir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
const usesRe = /uses:\s*([^\s#]+)/g
let failed = 0
let warnings = 0
const checks = []

for (const file of files) {
  const src = readFileSync(join(wfDir, file), "utf8")
  let m
  while ((m = usesRe.exec(src))) {
    const ref = m[1].trim()
    if (ref.startsWith("./") || ref.startsWith("docker://")) continue
    const name = `${file}: ${ref}`
    if (/@(main|master|head)$/i.test(ref)) {
      checks.push({ name, pass: false, detail: "floating branch ref forbidden" })
      failed++
      continue
    }
    // Full SHA (40 hex) after @
    if (/@[0-9a-f]{40}$/i.test(ref)) {
      checks.push({ name, pass: true, detail: "SHA-pinned" })
      continue
    }
    // Tag like @v5 or @v4.2.2
    if (/@v?\d+/.test(ref)) {
      checks.push({ name, pass: true, detail: "tag-pinned (SHA preferred)" })
      warnings++
      continue
    }
    checks.push({ name, pass: false, detail: "unrecognized pin form" })
    failed++
  }
}

for (const c of checks) {
  const label = c.pass ? (c.detail.includes("preferred") || c.detail.includes("SHA preferred") ? "WARN" : "PASS") : "FAIL"
  if (label === "WARN") console.log(`WARN ${c.name} — ${c.detail}`)
  else console.log(`${label} ${c.name}${c.detail ? " — " + c.detail : ""}`)
}
console.log(`\nPhase 3 actions pinning: ${checks.length - failed}/${checks.length} acceptable (${warnings} tag-only warnings)`)
if (failed) process.exit(1)
