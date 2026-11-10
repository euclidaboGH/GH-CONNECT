#!/usr/bin/env node
/**
 * Fast lexical guard for canonical SQL migrations. This catches unterminated
 * strings/comments/dollar-quoted bodies and unbalanced parentheses; it is not
 * a substitute for PostgreSQL parsing or disposable-database execution.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = join(process.cwd(), 'supabase', 'migrations')
const files = readdirSync(root).filter((name) => name.endsWith('.sql')).sort()
const failures = []

for (const name of files) {
  const source = readFileSync(join(root, name), 'utf8')
  let state = 'normal'
  let dollarTag = ''
  let depth = 0
  let line = 1
  for (let i = 0; i < source.length;) {
    const c = source[i]
    const n = source[i + 1] ?? ''
    if (c === '\n') line += 1
    if (state === 'normal') {
      if (c === '-' && n === '-') { state = 'line'; i += 2; continue }
      if (c === '/' && n === '*') { state = 'block'; i += 2; continue }
      if (c === "'") { state = 'single'; i += 1; continue }
      if (c === '"') { state = 'double'; i += 1; continue }
      if (c === '$') {
        const match = source.slice(i).match(/^\$[A-Za-z_][A-Za-z_0-9]*\$|^\$\$/)
        if (match) { dollarTag = match[0]; state = 'dollar'; i += dollarTag.length; continue }
      }
      if (c === '(') depth += 1
      if (c === ')') {
        depth -= 1
        if (depth < 0) { failures.push(`${name}:${line}: unexpected closing parenthesis`); depth = 0 }
      }
      i += 1
    } else if (state === 'line') {
      if (c === '\n') state = 'normal'
      i += 1
    } else if (state === 'block') {
      if (c === '*' && n === '/') { state = 'normal'; i += 2 } else i += 1
    } else if (state === 'single') {
      if (c === "'" && n === "'") i += 2
      else if (c === "'") { state = 'normal'; i += 1 }
      else i += 1
    } else if (state === 'double') {
      if (c === '"' && n === '"') i += 2
      else if (c === '"') { state = 'normal'; i += 1 }
      else i += 1
    } else if (state === 'dollar') {
      if (source.startsWith(dollarTag, i)) { i += dollarTag.length; state = 'normal' }
      else i += 1
    }
  }
  if (state !== 'normal' && state !== 'line') failures.push(`${name}:${line}: unterminated ${state} construct`)
  if (depth !== 0) failures.push(`${name}:${line}: unbalanced parentheses (${depth})`)
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
  console.error(`SQL lexical integrity: ${files.length} migrations scanned; ${failures.length} issue(s)`)
  process.exit(1)
}
console.log(`SQL lexical integrity: PASS (${files.length} migrations; strings, comments, dollar quotes and parentheses balanced)`)
