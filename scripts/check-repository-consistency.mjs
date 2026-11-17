#!/usr/bin/env node
/**
 * Repository-wide guard for package/runtime drift and broken local imports.
 * This complements (and does not replace) the TypeScript compiler.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const checks = []
const test = (name, ok, detail = "") => {
  checks.push(Boolean(ok))
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`)
}
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"))

const pkg = readJson("package.json")
const lock = readJson("package-lock.json")
const lockRoot = lock.packages?.[""]
const nvmrc = fs.readFileSync(path.join(root, ".nvmrc"), "utf8").trim()
const requiredNode = pkg.engines?.node
const minimumNode = requiredNode?.match(/^\^(\d+\.\d+\.\d+)$/)?.[1]

test("package and lockfile identity are synchronized", Boolean(lockRoot) && lockRoot.name === pkg.name && lockRoot.version === pkg.version)
test("package and lockfile Node engine declarations match", Boolean(lockRoot) && lockRoot.engines?.node === requiredNode)
test(".nvmrc pins the minimum supported Node runtime", Boolean(minimumNode) && nvmrc === minimumNode, `${nvmrc || "missing"} / ${requiredNode || "missing"}`)
test("project remains explicitly ESM", pkg.type === "module")

const ignoredDirectories = new Set([".git", ".next", ".vercel", "node_modules", "coverage", "dist", "build"])
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"])
const moduleExtensions = [
  "", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", ".scss",
  ".sass", ".less", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".mp4", ".webm",
]
const sourceFiles = []
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(absolute)
    else if (sourceExtensions.has(path.extname(entry.name))) sourceFiles.push(absolute)
  }
}
walk(root)

const unresolved = []
const importPattern = /(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*["']([^"']+)["']/g
for (const sourceFile of sourceFiles) {
  const source = fs.readFileSync(sourceFile, "utf8")
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1]
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) continue
    const base = specifier.startsWith("@/")
      ? path.join(root, specifier.slice(2))
      : path.resolve(path.dirname(sourceFile), specifier)
    const candidates = moduleExtensions.flatMap((extension) => {
      const candidate = `${base}${extension}`
      return [candidate, path.join(candidate, "index.ts"), path.join(candidate, "index.tsx"), path.join(candidate, "index.js")]
    })
    if (!candidates.some((candidate) => fs.existsSync(candidate))) {
      unresolved.push(`${path.relative(root, sourceFile)} -> ${specifier}`)
    }
  }
}
test("all relative and @/ source imports resolve", unresolved.length === 0, `${sourceFiles.length} files scanned; ${unresolved.length} unresolved`)
for (const issue of unresolved.slice(0, 30)) console.log(`  ${issue}`)

const missingScriptTargets = []
for (const [scriptName, command] of Object.entries(pkg.scripts ?? {})) {
  const scriptMatches = command.matchAll(/(?:^|\s)node\s+(?:--[^\s]+\s+)*scripts\/([\w.-]+\.mjs)/g)
  for (const match of scriptMatches) {
    if (!fs.existsSync(path.join(root, "scripts", match[1]))) missingScriptTargets.push(`${scriptName}: ${match[1]}`)
  }
}
test("all directly referenced npm script targets exist", missingScriptTargets.length === 0, `${missingScriptTargets.length} missing targets`)
for (const issue of missingScriptTargets.slice(0, 30)) console.log(`  ${issue}`)

const failed = checks.filter((passed) => !passed).length
console.log(`\nRepository consistency: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
