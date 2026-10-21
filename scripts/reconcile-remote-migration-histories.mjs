#!/usr/bin/env node
/**
 * Read-only reconciliation of local migration filename versions against saved
 * `supabase migration list` output for Testnet and Mainnet. Never connects to DB,
 * edits migration files, or runs migration commands.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migrationDir = join(root, 'supabase', 'migrations')

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]
    if (!['--testnet', '--mainnet', '--out'].includes(key)) continue
    const value = argv[++i]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`)
    args[key.slice(2)] = value
  }
  if (!args.testnet || !args.mainnet) {
    throw new Error('Usage: node scripts/reconcile-remote-migration-histories.mjs --testnet <saved-testnet-list.txt> --mainnet <saved-mainnet-list.txt> [--out <report.md>]')
  }
  return args
}

function readRemoteVersions(filePath, environment) {
  const content = readFileSync(resolve(filePath), 'utf8')
  const lines = content.split(/\r?\n/)
  const headerIndex = lines.findIndex((line) => {
    const cells = line.split('|').map((cell) => cell.trim().toLowerCase())
    return cells.includes('local') && cells.includes('remote')
  })
  if (headerIndex < 0) {
    throw new Error(`${environment}: ${filePath} is not recognizable Supabase migration-list table output (expected Local | Remote header). Capture the complete unedited output.`)
  }
  const header = lines[headerIndex].split('|').map((cell) => cell.trim().toLowerCase())
  const remoteIndex = header.indexOf('remote')
  const versions = new Set()
  let rows = 0
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.includes('|')) continue
    const cells = line.split('|').map((cell) => cell.trim())
    const raw = cells[remoteIndex] ?? ''
    if (/^\d+$/.test(raw)) {
      versions.add(raw)
      rows++
    }
  }
  if (!rows) throw new Error(`${environment}: no remote migration versions were parsed from ${filePath}; refusing to treat this as an empty remote history.`)
  return { versions, rows, filePath: resolve(filePath) }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const files = readdirSync(migrationDir).filter((file) => file.endsWith('.sql')).sort()
  const byVersion = new Map()
  const invalid = []
  for (const file of files) {
    const match = file.match(/^(\d+)_/)
    if (!match) {
      invalid.push(file)
      continue
    }
    const version = match[1]
    const group = byVersion.get(version) ?? []
    group.push(file)
    byVersion.set(version, group)
  }
  const testnet = readRemoteVersions(args.testnet, 'Testnet')
  const mainnet = readRemoteVersions(args.mainnet, 'Mainnet')
  const localVersions = new Set(byVersion.keys())
  const duplicateVersions = [...byVersion.entries()].filter(([, group]) => group.length > 1)
  const envs = [ ['Testnet', testnet], ['Mainnet', mainnet] ]
  const lines = [
    '# GreenHaven remote migration-history reconciliation', '',
    `- Local SQL files scanned: ${files.length}`,
    `- Local distinct numeric prefixes: ${localVersions.size}`,
    `- Testnet source: \`${testnet.filePath}\` (${testnet.rows} remote rows parsed)`,
    `- Mainnet source: \`${mainnet.filePath}\` (${mainnet.rows} remote rows parsed)`,
    '- Mode: read-only comparison; no database was contacted and no files were changed.', '',
    '## Local filename/version ambiguities', ''
  ]
  if (invalid.length) lines.push(`- **BLOCK**: filenames without a numeric prefix: ${invalid.map((f) => `\`${f}\``).join(', ')}`)
  if (!invalid.length) lines.push('- No filenames missing a numeric prefix.')
  if (duplicateVersions.length) {
    for (const [version, group] of duplicateVersions) {
      lines.push(`- **BLOCK — version \`${version}\` maps to ${group.length} local files:** ${group.map((f) => `\`${f}\``).join(', ')}`)
      for (const [name, env] of envs) {
        lines.push(`  - ${name}: remote version ${env.versions.has(version) ? '**exists**' : 'not present in captured output'}. The history version alone cannot identify which SQL body, if any, was applied.`)
      }
    }
  } else lines.push('- No duplicate local numeric prefixes.')

  for (const [name, env] of envs) {
    const remoteOnly = [...env.versions].filter((version) => !localVersions.has(version)).sort()
    const localMissingRemote = [...byVersion.entries()].filter(([version]) => !env.versions.has(version)).sort(([a], [b]) => a.localeCompare(b))
    lines.push('', `## ${name}`, '', `- Remote versions absent from local filenames: ${remoteOnly.length}`, `- Local versions absent from remote history: ${localMissingRemote.length}`, '', '| Local version | Local SQL file(s) | Comparison |', '|---|---|---|')
    for (const [version, group] of [...byVersion.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const status = group.length > 1
        ? (env.versions.has(version) ? 'AMBIGUOUS: remote version exists; applied file body unknown' : 'AMBIGUOUS: duplicate local version not found remotely')
        : (env.versions.has(version) ? 'Version present remotely; checksum/body not verified' : 'Not present remotely; pending status requires review')
      lines.push(`| \`${version}\` | ${group.map((f) => `\`${f}\``).join('<br>')} | ${status} |`)
    }
    if (remoteOnly.length) {
      lines.push('', 'Remote-only versions requiring investigation:', ...remoteOnly.map((version) => `- \`${version}\``))
    }
  }
  lines.push('', '## Safety conclusion', '',
    '- A matching version proves only that a version string exists in the remote history; Supabase migration history does not establish that the local SQL file has identical contents.',
    '- Do not rename, move, delete, repair, or apply migrations based on this report alone. Investigate duplicate versions, remote-only versions, content drift, dependencies, and the actual schema state in each environment first.',
    '- Do not run `supabase db push` while any local duplicate version or unresolved migration remains.',
    '- This report does not validate SQL syntax or runtime behavior; validate reviewed migrations on a disposable PostgreSQL/Testnet clone before approval.', '')
  const report = lines.join('\n')
  if (args.out) {
    const out = resolve(args.out)
    writeFileSync(out, report)
    console.log(`Wrote read-only reconciliation report: ${out}`)
  } else console.log(report)
  if (duplicateVersions.length || invalid.length) process.exitCode = 2
}

try { main() } catch (error) {
  console.error(`Migration reconciliation blocked: ${error.message}`)
  process.exit(1)
}
