#!/usr/bin/env node
/**
 * Remove stale Webpack cache packs restored from prior Vercel deployments.
 * Safe no-op when cache is absent. Production build runs without persistent Webpack cache.
 */
import { existsSync, lstatSync, rmSync } from "node:fs"
import { resolve, sep } from "node:path"

const root = resolve(process.cwd())
const target = resolve(root, ".next", "cache", "webpack")
if (!target.startsWith(`${root}${sep}`)) {
  throw new Error("Refusing to clean a path outside the project root")
}
try {
  if (!existsSync(target)) {
    console.log("[vercel-build] No stale Webpack cache found")
  } else {
    const stat = lstatSync(target)
    if (stat.isSymbolicLink()) throw new Error("Refusing to clean a symlinked Webpack cache")
    rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    console.log("[vercel-build] Removed stale .next/cache/webpack to avoid restoring oversized build packs")
  }
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    console.log("[vercel-build] No stale Webpack cache found")
  } else {
    throw error
  }
}
