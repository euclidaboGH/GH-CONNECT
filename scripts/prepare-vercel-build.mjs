#!/usr/bin/env node
/**
 * Remove stale, memory-heavy Webpack cache packs restored from prior Vercel
 * deployments. The production build intentionally runs without Webpack's
 * persistent cache; source and generated application output are untouched.
 */
import { lstatSync, rmSync } from "node:fs"
import { resolve, sep } from "node:path"

const root = resolve(process.cwd())
const target = resolve(root, ".next", "cache", "webpack")
if (!target.startsWith(`${root}${sep}`)) {
  throw new Error("Refusing to clean a path outside the project root")
}
try {
  const stat = lstatSync(target)
  if (stat.isSymbolicLink()) throw new Error("Refusing to clean a symlinked Webpack cache")
  rmSync(target, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 })
  console.log("[vercel-build] Removed stale .next/cache/webpack to avoid restoring oversized build packs")
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    console.log("[vercel-build] No stale Webpack cache found")
  } else {
    throw error
  }
}
