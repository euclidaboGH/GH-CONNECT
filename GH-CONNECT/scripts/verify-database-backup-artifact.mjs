#!/usr/bin/env node
/** Verify a PostgreSQL custom-format dump artifact without connecting to or modifying any database. */
import { createHash } from 'node:crypto'
import { statSync, createReadStream } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const fileArg = process.argv.find((arg) => !arg.startsWith('-') && arg !== process.argv[0] && arg !== process.argv[1])
if (!fileArg || process.argv.includes('--help')) {
  console.log('Usage: node scripts/verify-database-backup-artifact.mjs <custom-format.dump> [--max-age-hours=24] [--min-bytes=1024]')
  console.log('Checks artifact existence/size/age, SHA-256, and pg_restore catalog readability. No database connection is made.')
  process.exit(fileArg ? 0 : 2)
}
const args = process.argv.slice(2)
const option = (name, fallback) => {
  const item = args.find((arg) => arg.startsWith(`--${name}=`))
  if (!item) return fallback
  const value = Number(item.slice(name.length + 3))
  if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid --${name} value`)
  return value
}
const maxAgeHours = option('max-age-hours', 24)
const minBytes = option('min-bytes', 1024)
const file = resolve(fileArg)
const failures = []
let stat
try { stat = statSync(file) } catch { console.error(`FAIL backup artifact is missing or unreadable: ${file}`); process.exit(1) }
if (!stat.isFile()) failures.push('artifact path is not a regular file')
if (stat.size < minBytes) failures.push(`artifact size ${stat.size} bytes is below minimum ${minBytes}`)
const ageHours = (Date.now() - stat.mtimeMs) / 3_600_000
if (ageHours < 0) failures.push('artifact modification time is in the future')
if (ageHours > maxAgeHours) failures.push(`artifact age ${ageHours.toFixed(2)}h exceeds maximum ${maxAgeHours}h`)
const hash = createHash('sha256')
for await (const chunk of createReadStream(file)) hash.update(chunk)
const digest = hash.digest('hex')
console.log(`Artifact: ${file}`)
console.log(`Size: ${stat.size} bytes`)
console.log(`Age: ${ageHours.toFixed(2)} hours`)
console.log(`SHA-256: ${digest}`)
const listing = spawnSync(process.env.PG_RESTORE_BIN || 'pg_restore', ['--list', file], { encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024 })
if (listing.error) failures.push(`pg_restore could not be executed: ${listing.error.message}`)
else if (listing.status !== 0) failures.push(`pg_restore --list rejected artifact: ${(listing.stderr || listing.stdout || 'unknown error').trim().slice(0, 500)}`)
else if (!/;\s*Archive created at\s+/i.test(listing.stdout) || !/;\s*Format:\s*CUSTOM/i.test(listing.stdout)) failures.push('artifact catalog did not identify a PostgreSQL custom-format archive')
else console.log('PASS pg_restore catalog is readable (this does not prove a successful restore)')
for (const failure of failures) console.error(`FAIL ${failure}`)
if (failures.length) process.exit(1)
console.log('PASS artifact checks complete; isolated restore drill is still required')
