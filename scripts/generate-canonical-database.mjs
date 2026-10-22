#!/usr/bin/env node
/**
 * Build the one-shot GreenHaven Supabase installer from the current migration source.
 *
 * Source of truth: supabase/migrations/*.sql
 * Output:       supabase/GREENHAVEN-CANONICAL-SUPABASE-INSTALL.sql
 *
 * The generator deliberately preserves migration SQL byte-for-byte inside the
 * installer and records SHA-256 for every source section.  New migrations are
 * automatically included when this command is run.
 */
import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('..', import.meta.url)))
const migrationDir = join(root, 'supabase', 'migrations')
const output = join(root, 'supabase', 'GREENHAVEN-CANONICAL-SUPABASE-INSTALL.sql')
const namePattern = /^\d{14}_.+\.sql$/
const objectNamePattern = /^[a-z_][a-z0-9_]*$/i
const greenhavenPrefix = /^(gh|ghc|ghpv)/i

const files = (await readdir(migrationDir))
  .filter(name => namePattern.test(name))
  .sort()

if (!files.length) throw new Error('No clean migration files found.')

const duplicateVersions = new Map()
for (const name of files) {
  const version = name.slice(0, 14)
  duplicateVersions.set(version, (duplicateVersions.get(version) ?? 0) + 1)
}
const duplicates = [...duplicateVersions.entries()].filter(([, count]) => count > 1)
if (duplicates.length) {
  throw new Error(`Duplicate migration versions: ${duplicates.map(([v, c]) => `${v} (${c})`).join(', ')}`)
}

// GreenHaven public application objects use the gh/ghc/ghpv naming contract.
// This is what makes the reset script future-proof for new migrations.
const objectPatterns = [
  /\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gi,
  /\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gi,
  /\bCREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gi,
  /\bCREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gi,
  /\bCREATE\s+(?:MATERIALIZED\s+)?VIEW\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gi,
  /\bCREATE\s+SEQUENCE\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gi,
  /\bCREATE\s+TYPE\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gi,
  /\bCREATE\s+DOMAIN\s+(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)/gi,
]

const sources = []
const objectViolations = []
for (const name of files) {
  const sql = await readFile(join(migrationDir, name), 'utf8')
  const sha256 = createHash('sha256').update(sql).digest('hex')
  sources.push({ name, sql, sha256 })
  for (const pattern of objectPatterns) {
    for (const match of sql.matchAll(pattern)) {
      const objectName = match[1]
      if (objectName && objectNamePattern.test(objectName) && !greenhavenPrefix.test(objectName)) {
        objectViolations.push(`${name}: ${objectName}`)
      }
    }
  }
}

if (objectViolations.length) {
  throw new Error(
    'Migration naming contract violation. Public GreenHaven objects must start with gh/ghc/ghpv:\n' +
    objectViolations.join('\n'),
  )
}

const header = `-- GREENHAVEN 0.70.3 — CANONICAL SUPABASE INSTALLER\n-- GENERATED FILE — DO NOT EDIT BY HAND\n-- Source of truth: supabase/migrations/*.sql\n-- Regenerate with: npm run db:generate-canonical\n-- This installer includes every current clean migration in lexical dependency order.\n-- Development history remains in supabase/migrations/.\n\n`

const body = sources.map((source, index) =>
  `-- ============================================================================\n` +
  `-- SOURCE ${String(index + 1).padStart(3, '0')}: ${source.name}\n` +
  `-- SHA256: ${source.sha256}\n` +
  `-- ============================================================================\n` +
  source.sql.replace(/\s+$/u, '') + '\n\n'
).join('')

await writeFile(output, header + body, 'utf8')
console.log(`Canonical installer generated: ${output}`)
console.log(`Included migrations: ${sources.length}`)
console.log(`Migration naming contract: PASS`)
