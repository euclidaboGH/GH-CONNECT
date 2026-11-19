#!/usr/bin/env node
/**
 * Stronger repository-only migration integrity check.
 * Detects exact duplicate SQL bytes, duplicate 14-digit Supabase versions,
 * empty files, duplicate basenames, and accidental promotion of review proposals.
 * It never connects to or changes a database and never rewrites migration history.
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const migrationDir = join(root, 'supabase', 'migrations')
const proposalDir = join(root, 'supabase', 'proposals')
const files = readdirSync(migrationDir).filter((name) => name.endsWith('.sql')).sort()
const errors = []
const versions = new Map()
const hashes = new Map()
const basenames = new Map()

for (const file of files) {
  const path = join(migrationDir, file)
  const stat = statSync(path)
  if (stat.size === 0) errors.push(`empty migration: ${file}`)
  const version = file.match(/^(\d{14})_/)
  if (!version) errors.push(`migration must begin with a 14-digit version: ${file}`)
  else {
    const prior = versions.get(version[1])
    if (prior) errors.push(`duplicate migration version ${version[1]}: ${prior} and ${file}`)
    versions.set(version[1], file)
  }
  const basename = file.replace(/^\d+_/, '')
  const priorName = basenames.get(basename)
  if (priorName) errors.push(`duplicate migration basename: ${priorName} and ${file}`)
  basenames.set(basename, file)

  const digest = createHash('sha256').update(readFileSync(path)).digest('hex')
  const priorHash = hashes.get(digest)
  if (priorHash) errors.push(`byte-identical migration files: ${priorHash} and ${file} (sha256 ${digest})`)
  hashes.set(digest, file)
}

if (!files.length) errors.push('no SQL migrations found')

// Review-only proposals must remain outside the canonical migration directory.
for (const proposal of readdirSync(proposalDir).filter((name) => name.endsWith('.sql'))) {
  if (files.includes(proposal)) errors.push(`review proposal is present in canonical migrations: ${proposal}`)
}

if (errors.length) {
  console.error(errors.map((error) => `FAIL ${error}`).join('\n'))
  process.exit(1)
}

console.log(`PASS migration duplicate integrity: ${files.length} files; ${versions.size} unique versions; ${hashes.size} unique SHA-256 digests; ${basenames.size} unique basenames`)
console.log('PASS review-only proposal boundary: proposal SQL remains outside canonical migrations')
console.log('NOTE repeated SQL object declarations across different migrations require semantic review; historical migrations were not modified')
