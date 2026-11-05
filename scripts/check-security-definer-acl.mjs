#!/usr/bin/env node
/** Static-only audit of SECURITY DEFINER function search_path and PUBLIC execute ACLs. */
import { readFile, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migrationDir = join(root, 'supabase', 'migrations')
const files = (await readdir(migrationDir)).filter((name) => /^\d{14}_.+\.sql$/.test(name)).sort()

function stripSqlComments(sql) {
  let out = '', i = 0, mode = 'normal'
  while (i < sql.length) {
    const c = sql[i], n = sql[i + 1]
    if (mode === 'normal') {
      if (c === '-' && n === '-') { mode = 'line'; out += '  '; i += 2; continue }
      if (c === '/' && n === '*') { mode = 'block'; out += '  '; i += 2; continue }
      if (c === "'") { mode = 'single'; out += c; i++; continue }
      if (c === '"') { mode = 'double'; out += c; i++; continue }
      out += c; i++; continue
    }
    if (mode === 'line') { if (c === '\n') { mode = 'normal'; out += '\n' } else out += ' '; i++; continue }
    if (mode === 'block') { if (c === '*' && n === '/') { mode = 'normal'; out += '  '; i += 2 } else { out += c === '\n' ? '\n' : ' '; i++ } continue }
    if (mode === 'single') { out += c; if (c === "'" && n === "'") { out += n; i += 2; continue } if (c === "'") mode = 'normal'; i++; continue }
    if (mode === 'double') { out += c; if (c === '"' && n === '"') { out += n; i += 2; continue } if (c === '"') mode = 'normal'; i++; continue }
  }
  return out
}

const sources = []
for (const file of files) sources.push({ file, sql: stripSqlComments(await readFile(join(migrationDir, file), 'utf8')) })
const allSql = sources.map((source) => source.sql).join('\n')
const routines = []
for (const source of sources) {
  const re = /\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+((?:public\.)?[a-z_][\w$]*)\s*\(/gi
  for (const match of source.sql.matchAll(re)) {
    const tail = source.sql.slice(match.index)
    const bodyStart = tail.search(/\bAS\s+\$(?:[a-z_][\w$]*)?\$/i)
    if (bodyStart < 0) continue
    const header = tail.slice(0, bodyStart)
    if (!/\bSECURITY\s+DEFINER\b/i.test(header)) continue
    const name = match[1].split('.').at(-1).toLowerCase()
    const searchPath = /\bSET\s+search_path\s*(?:=|TO)\s*[^\n,;]+/i.test(header)
    // Function signatures may be overloaded. Require at least one explicit PUBLIC revoke for this routine name;
    // detailed overload/grant equivalence still requires live catalog verification.
    const publicRevoke = new RegExp(`\\bREVOKE\\s+(?:ALL|EXECUTE)\\s+ON\\s+FUNCTION\\s+(?:public\\.)?${name.replace(/[$]/g, '\\$')}\\s*\\([\\s\\S]*?\\)\\s+FROM\\s+[^;]*\\bPUBLIC\\b`, 'i').test(allSql)
    routines.push({ file: source.file, name, searchPath, publicRevoke })
  }
}
const failures = []
if (!files.length) failures.push('No canonical migration files found.')
if (!routines.length) failures.push('No SECURITY DEFINER function declarations found; audit cannot establish coverage.')
for (const routine of routines) {
  if (!routine.searchPath) failures.push(`${routine.file}: ${routine.name} has no SET search_path in its CREATE FUNCTION header.`)
  if (!routine.publicRevoke) failures.push(`${routine.file}: ${routine.name} has no matching PUBLIC execute revoke in migration source.`)
}
if (failures.length) {
  console.error(failures.map((failure) => `FAIL ${failure}`).join('\n'))
  process.exit(1)
}
console.log(`PASS SECURITY DEFINER source audit: ${routines.length} declarations include SET search_path and a matching PUBLIC execute revoke.`)
console.log('LIMIT: overload-level ACL equivalence, effective role grants, function ownership, deployed catalog state, and runtime exploitability require live database verification.')
