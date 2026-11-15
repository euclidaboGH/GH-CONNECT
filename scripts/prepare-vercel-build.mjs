#!/usr/bin/env node
/**
 * Remove stale Webpack cache packs restored from prior Vercel deployments.
 * Safe no-op when cache is absent. Production build runs without persistent Webpack cache.
 */
import { existsSync, lstatSync, rmSync } from "node:fs"
import { resolve, sep } from "node:path"

const root = resolve(process.cwd())
const targets = [
  resolve(root, ".next", "cache", "webpack"),
  resolve(root, ".next", "cache"),
]
for (const target of targets) {
  if (!target.startsWith(`${root}${sep}`)) {
    throw new Error("Refusing to clean a path outside the project root")
  }
  try {
    if (!existsSync(target)) {
      console.log(`[vercel-build] No cache at ${target.replace(root, ".")}`)
      continue
    }
    const stat = lstatSync(target)
    if (stat.isSymbolicLink()) throw new Error("Refusing to clean a symlinked cache path")
    rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    console.log(`[vercel-build] Removed ${target.replace(root, ".")}`)
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      console.log(`[vercel-build] Cache already absent: ${target.replace(root, ".")}`)
    } else {
      throw error
    }
  }
}
