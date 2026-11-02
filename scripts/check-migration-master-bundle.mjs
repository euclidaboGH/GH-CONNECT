#!/usr/bin/env node
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
const root = process.cwd()
const dir = join(root, 'supabase', 'migrations')
const bundlePath = join(root, 'supabase', 'GH-CONNECT-CANONICAL-MIGRATION-BUNDLE-0.274.3.sql')
const manifestPath = join(root, 'MIGRATION-SOURCE-MANIFEST.csv')
const names = readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()
const writeBundle = process.argv.includes('--write')
const rows = readFileSync(manifestPath, 'utf8').trim().split(/\r?\n/).slice(1).map((line) => {
  const m = line.match(/^([^,]+),(REQUIRED|REQUIRES_APPROVAL|PROPOSAL|REVIEW_REQUIRED),(\d+)$/)
  if (!m) throw new Error(`Invalid migration manifest row: ${line}`)
  return { filename: m[1], classification: m[2], bytes: Number(m[3]) }
})
if (names.length !== rows.length) throw new Error(`Manifest count ${rows.length} != canonical source count ${names.length}`)
const counts = Object.fromEntries(['REQUIRED', 'REQUIRES_APPROVAL', 'PROPOSAL', 'REVIEW_REQUIRED'].map((kind) => [kind, rows.filter((row) => row.classification === kind).length]))
const classification = new Map(rows.map((r) => [r.filename, r.classification]))
const parts = [`-- GH-CONNECT v0.274.3 — CONSOLIDATED CANONICAL MIGRATION SOURCE BUNDLE\n-- Generated from supabase/migrations/*.sql; canonical files: ${names.length}.\n-- Classifications: REQUIRED=${counts.REQUIRED}; REQUIRES_APPROVAL=${counts.REQUIRES_APPROVAL}; PROPOSAL=${counts.PROPOSAL}; REVIEW_REQUIRED=${counts.REVIEW_REQUIRED}.\n-- PURPOSE: single review/search/archival document containing every canonical migration source.\n-- IMPORTANT: THIS BUNDLE IS NOT AN EXECUTABLE INSTALLER. DO NOT RUN THIS FILE AS ONE SCRIPT.\n-- Each original migration must be individually reconciled with the target Supabase migration history,\n-- reviewed for dependencies/classification, and applied using the original individual file only after\n-- approval. This combined bundle may contain transaction boundaries and sequencing assumptions that\n-- make monolithic execution unsafe. Never use it to bypass migration review or target-history checks.\n-- Testnet and Mainnet migration histories must be reconciled independently.\n-- SHA-256 per source is recorded in each section header below.\n\n`]
for (let i = 0; i < names.length; i += 1) {
  const name = names[i]
  const path = join(dir, name)
  const data = readFileSync(path)
  const source = data.toString('utf8')
  if (Number(rows[i].bytes) !== statSync(path).size || rows[i].filename !== name) throw new Error(`Manifest mismatch: ${name}`)
  const sha = createHash('sha256').update(data).digest('hex')
  parts.push(`\n-- ============================================================================\n-- SOURCE ${String(i + 1).padStart(3, '0')}/${names.length}: ${name}\n-- CLASSIFICATION: ${classification.get(name)}\n-- SOURCE_BYTES: ${data.length}\n-- SOURCE_SHA256: ${sha}\n-- ============================================================================\n`)
  parts.push(source.endsWith('\n') || !source ? source : source + '\n')
  parts.push(`\n-- END SOURCE: ${name}\n`)
}
const expected = parts.join('')
if (writeBundle) {
  writeFileSync(bundlePath, expected)
  console.log(`Consolidated migration bundle: GENERATED (${names.length} source files)`)
} else {
  const actual = readFileSync(bundlePath, 'utf8')
  if (actual !== expected) throw new Error('Consolidated migration bundle is stale or differs from canonical source files')
  console.log(`Consolidated migration bundle: PASS (${names.length}/${names.length} source files, byte-for-byte synchronized)`)
}
