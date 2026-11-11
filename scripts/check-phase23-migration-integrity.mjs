#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
const failures = []
const dir = 'supabase/migrations'
const files = fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()
const versions = new Map()
let securityDefinerCount = 0
for (const file of files) {
  const full = path.join(dir, file)
  const sql = fs.readFileSync(full, 'utf8')
  if (!/^\d{14}_.*\.sql$/.test(file)) failures.push(`noncanonical migration filename: ${file}`)
  if (!sql.trim()) failures.push(`empty migration: ${file}`)
  const version = file.slice(0, 14)
  if (versions.has(version)) failures.push(`duplicate migration version ${version}: ${versions.get(version)} / ${file}`)
  versions.set(version, file)
  const defs = [...sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w.]+)\s*\([\s\S]*?\)\s*([\s\S]*?)\$\$/gi)]
  for (const def of defs) {
    const header = def[2] || ''
    if (/SECURITY\s+DEFINER/i.test(header)) {
      securityDefinerCount += 1
      if (!/SET\s+search_path\s*(?:=|TO)\s*(?:pg_catalog\s*,\s*)?public/i.test(header)) failures.push(`${file}: SECURITY DEFINER ${def[1]} missing fixed search_path`)
    }
  }
  if (/\bDROP\s+SCHEMA\s+public\b/i.test(sql)) failures.push(`${file}: destructive public schema drop requires separate manual approval`)
}
const verifiedManifest = fs.readFileSync('VERIFIED_MANIFEST.txt', 'utf8')
const verifiedCount = Number((verifiedManifest.match(/^canonical_migrations=(\d+)$/m) || [])[1])
if (files.length !== verifiedCount || !verifiedManifest.includes('inventory_status=OK')) failures.push(`canonical migration inventory does not match verified manifest: ${files.length} vs ${verifiedCount}`)
const manifest = fs.readFileSync('MIGRATION-SOURCE-MANIFEST.csv', 'utf8').trim().split(/\r?\n/)
if (manifest.length !== files.length + 1) failures.push('migration source manifest row count does not match canonical SQL files')
const phase23 = fs.readFileSync(path.join(dir, '20261104170001_marketplace_order_read_cleanup_separation.sql'), 'utf8')
if (!phase23) failures.push('Phase 23 migration missing')
if (/PERFORM\s+public\.gh_marketplace_release_expired_reservations/i.test(phase23)) failures.push('Phase 23 order read must not perform global reservation cleanup')
const store = fs.readFileSync('lib/server/marketplace/order-store.ts', 'utf8')
if (!/const cleanup = await rpcJson\("gh_marketplace_release_expired_reservations"/.test(store)) failures.push('application loadOrder must explicitly clean expired reservations before snapshot read')
if (!/cleanup as Record<string, unknown>\)\.ok !== true/.test(store)) failures.push('order read must fail closed if reservation cleanup is unavailable')
if (failures.length) {
  console.error(`Phase 23 migration integrity: FAIL (${failures.length})`)
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}
console.log(`Phase 23 migration integrity: PASS (${files.length} canonical migrations; ${securityDefinerCount} SECURITY DEFINER definitions checked for fixed search_path)`)
