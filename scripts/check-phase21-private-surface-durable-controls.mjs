#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const criticalRoutes = [
  { file: 'app/api/messaging/conversations/[conversationId]/messages/route.ts', count: 4 },
  { file: 'app/api/media/[id]/signed-url/route.ts', count: 1 },
  { file: 'app/api/media/direct-upload-intent/route.ts', count: 1 },
  { file: 'app/api/media/route.ts', count: 2 },
  { file: 'app/api/account/export/route.ts', count: 1 },
  { file: 'app/api/account/lifecycle/route.ts', count: 1 },
]
const failures = []
for (const route of criticalRoutes) {
  const absolute = path.join(root, route.file)
  if (!fs.existsSync(absolute)) { failures.push(`${route.file}: route missing`); continue }
  const source = fs.readFileSync(absolute, 'utf8')
  const calls = source.match(/await\s+checkDurableRateLimit\(/g) || []
  if (calls.length !== route.count) failures.push(`${route.file}: expected ${route.count} awaited durable limits, found ${calls.length}`)
  if (!source.includes('onUnavailable: "deny"')) failures.push(`${route.file}: durable limiter must deny when unavailable`)
  if (!source.includes('durableRateLimitStatus') || !source.includes('durableRateLimitCode')) failures.push(`${route.file}: 429/503 status and error mapping missing`)
  if (/\bcheckRateLimit\s*\(/.test(source) || source.includes('@/lib/server/economy/rate-limit')) failures.push(`${route.file}: process-local limiter remains`)
}
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const packageLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'))
if (packageJson.version !== packageLock.version || packageJson.version !== packageLock.packages?.['']?.version) failures.push('package and lockfile versions disagree')
for (const pipeline of ['prebuild:checks', 'verify:static']) {
  const script = packageJson.scripts?.[pipeline] || ''
  if (!script.includes('check-phase21-private-surface-durable-controls.mjs')) failures.push(`${pipeline}: Phase 21 durable-control gate is not registered`)
}
const migrationDir = path.join(root, 'supabase/migrations')
const migrationFiles = fs.readdirSync(migrationDir).filter(name => /^\d+.*\.sql$/.test(name)).sort()
const prefixes = migrationFiles.map(name => name.match(/^\d+/)?.[0])
if (new Set(prefixes).size !== prefixes.length) failures.push('duplicate migration numeric prefixes detected')
const manifestPath = path.join(root, 'MIGRATION-SOURCE-MANIFEST.csv')
if (!fs.existsSync(manifestPath)) failures.push('migration source manifest missing')
else {
  const lines = fs.readFileSync(manifestPath, 'utf8').trim().split(/\r?\n/)
  const rows = lines.slice(1).map(line => {
    const [filename, classification, bytes] = line.split(',')
    return { filename, classification, bytes: Number(bytes) }
  })
  if (rows.length !== migrationFiles.length) failures.push(`migration manifest row count ${rows.length} does not match SQL count ${migrationFiles.length}`)
  const manifestNames = new Set(rows.map(row => row.filename))
  if (manifestNames.size !== rows.length) failures.push('duplicate migration manifest filenames detected')
  for (const name of migrationFiles) {
    if (!manifestNames.has(name)) failures.push(`migration absent from manifest: ${name}`)
    const row = rows.find(item => item.filename === name)
    if (row && row.bytes !== fs.statSync(path.join(migrationDir, name)).size) failures.push(`migration byte count mismatch: ${name}`)
    if (row && !['REQUIRED', 'REVIEW_REQUIRED', 'REQUIRES_APPROVAL', 'PROPOSAL'].includes(row.classification)) failures.push(`invalid migration classification: ${name}`)
  }
  for (const row of rows) if (!migrationFiles.includes(row.filename)) failures.push(`manifest references missing migration: ${row.filename}`)
}
if (failures.length) {
  console.error(`Phase 21 private-surface durable-control gate: ${failures.length} failure(s)`)
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}
console.log(`Phase 21 private-surface durable-control gate: PASS (${criticalRoutes.reduce((n, route) => n + route.count, 0)} durable boundaries; ${migrationFiles.length} migrations and manifest synchronized)`)
