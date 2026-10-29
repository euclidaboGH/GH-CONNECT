#!/usr/bin/env node
/**
 * Verify the executable GreenHaven table contract from migration source.
 *
 * Important: do not count CREATE TABLE text inside SQL comments. The source
 * intentionally contains proposal/note migrations whose examples are comments.
 * This is a source inventory count only; it is not a claim about any remote database.
 */
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('..', import.meta.url)))
const migrationDir = join(root, 'supabase', 'migrations')
const files = (await readdir(migrationDir)).filter(n => /^\d{14}_.+\.sql$/.test(n)).sort()

function stripSqlComments(sql) {
  let out = ''
  let i = 0
  let mode = 'normal'
  while (i < sql.length) {
    const c = sql[i]
    const n = sql[i + 1]
    if (mode === 'normal') {
      if (c === '-' && n === '-') { mode = 'line'; out += '  '; i += 2; continue }
      if (c === '/' && n === '*') { mode = 'block'; out += '  '; i += 2; continue }
      if (c === "'") { mode = 'single'; out += c; i++; continue }
      out += c; i++; continue
    }
    if (mode === 'line') {
      if (c === '\n') { mode = 'normal'; out += '\n' } else out += ' '
      i++; continue
    }
    if (mode === 'block') {
      if (c === '*' && n === '/') { mode = 'normal'; out += '  '; i += 2 } else { out += c === '\n' ? '\n' : ' '; i++ }
      continue
    }
    if (mode === 'single') {
      out += c
      if (c === "'" && n === "'") { out += n; i += 2; continue }
      if (c === "'") mode = 'normal'
      i++; continue
    }
  }
  return out
}

const tables = new Set()
for (const file of files) {
  const raw = await readFile(join(migrationDir, file), 'utf8')
  const sql = stripSqlComments(raw)
  for (const m of sql.matchAll(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?((?:gh|ghc|ghpv)[A-Za-z0-9_]*)/gi)) {
    tables.add(m[1].toLowerCase())
  }
}

const expectedRequired = [
  'gh_posts','gh_post_comments','gh_post_reactions','gh_post_curations',
  'gh_follows','ghc_user_blocks','gh_community_members',
  'gh_marketplace_listings','gh_marketplace_orders','gh_content_events',
  'gh_media_assets','gh_social_notifications','gh_conversations','gh_messages',
  'gh_user_profiles','ghc_transactions','ghc_payment_intents',
  'ghc_membership_entitlements','ghc_withdrawal_requests',
]
const proposalOnly = ['ghc_community_join_reasons', 'ghc_economic_telemetry']
const missing = expectedRequired.filter(n => !tables.has(n))
const proposalAccidentallyExecutable = proposalOnly.filter(n => tables.has(n))

if (files.length < 133) throw new Error(`Expected at least 133 clean migrations, found ${files.length}`)
if (tables.size !== 117) throw new Error(`Expected 117 executable GreenHaven tables in source, found ${tables.size}`)
if (missing.length) throw new Error(`Missing required executable GreenHaven tables: ${missing.join(', ')}`)
if (proposalAccidentallyExecutable.length) throw new Error(`Proposal-only tables became executable: ${proposalAccidentallyExecutable.join(', ')}`)

console.log(`PASS database source contract: ${tables.size} executable GreenHaven tables across ${files.length} clean migrations`)
console.log(`PASS proposal-only table examples remain non-executable: ${proposalOnly.join(', ')}`)
