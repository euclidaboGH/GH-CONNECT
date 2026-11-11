#!/usr/bin/env node
/**
 * Non-blocking postbuild footprint report. Measures the checked-out workspace,
 * including .next and node_modules, while avoiding .git/.vercel and symlinks.
 * This makes unexpectedly large generated folders/files visible in CI/Vercel logs.
 */
import { lstatSync, readdirSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'

const root = resolve(process.cwd())
const excluded = new Set(['.git', '.vercel'])
const maxEntries = 300_000
const largestLimit = 20
const topLevel = new Map()
const largest = []
let fileCount = 0
let totalBytes = 0
let truncated = false

function addLargest(path, size) {
  if (size < 10 * 1024 * 1024) return
  if (/\/(?:\.env(?:\.|$)|[^/]+\.(?:pem|key|p12|pfx))$/i.test(path.replaceAll(sep, '/'))) return
  largest.push({ path, size })
  largest.sort((a, b) => b.size - a.size)
  if (largest.length > largestLimit) largest.length = largestLimit
}

function walk(directory, rootName = null) {
  let entries
  try {
    entries = readdirSync(directory, { withFileTypes: true })
  } catch (error) {
    console.warn(`[build-footprint] Skipped unreadable directory ${relative(root, directory)}: ${error?.code || 'READ_ERROR'}`)
    return
  }

  for (const entry of entries) {
    if (fileCount >= maxEntries) {
      truncated = true
      return
    }
    if (directory === root && excluded.has(entry.name)) continue
    const fullPath = resolve(directory, entry.name)
    if (entry.isSymbolicLink()) continue

    if (entry.isDirectory()) {
      walk(fullPath, rootName || entry.name)
      if (truncated) return
      continue
    }

    let size
    try {
      size = lstatSync(fullPath).size
    } catch {
      continue
    }
    fileCount += 1
    totalBytes += size
    const group = rootName || '(root files)'
    topLevel.set(group, (topLevel.get(group) || 0) + size)
    addLargest(relative(root, fullPath), size)
  }
}

try {
  walk(root)
  const mb = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  console.log(`[build-footprint] Workspace excluding .git/.vercel: ${mb(totalBytes)} across ${fileCount.toLocaleString('en-US')} files${truncated ? ' (scan capped)' : ''}`)
  console.log('[build-footprint] Largest top-level folders:')
  for (const [name, size] of [...topLevel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${mb(size).padStart(10)}  ${name}`)
  }
  if (largest.length) {
    console.log('[build-footprint] Largest individual files (10 MB+):')
    for (const item of largest) console.log(`  ${mb(item.size).padStart(10)}  ${item.path}`)
  }
} catch (error) {
  // Diagnostics must never turn an otherwise successful production build red.
  console.warn(`[build-footprint] Report unavailable: ${error instanceof Error ? error.message : 'UNKNOWN_ERROR'}`)
}
