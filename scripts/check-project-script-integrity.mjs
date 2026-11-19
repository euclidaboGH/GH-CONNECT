#!/usr/bin/env node
/**
 * Repository command-manifest audit. Detects stale script references and
 * accidental duplicate commands in npm lifecycle/verification chains.
 * Does not execute application code or mutate project state.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const failures = []
let checked = 0

for (const [name, value] of Object.entries(pkg.scripts ?? {})) {
  if (typeof value !== 'string') {
    failures.push(`${name}: script value is not a string`)
    continue
  }
  const commands = value.split(/\s*&&\s*/).map((part) => part.trim()).filter(Boolean)
  const seen = new Set()
  for (const command of commands) {
    checked += 1
    if (seen.has(command)) failures.push(`${name}: repeated command: ${command}`)
    seen.add(command)

    // Inspect explicit repository-local .mjs/.js/.ts script paths in commands.
    const match = command.match(/(?:^|\s)(scripts\/[A-Za-z0-9_./-]+\.(?:mjs|js|ts))(?:\s|$)/)
    if (match && !existsSync(resolve(root, match[1]))) {
      failures.push(`${name}: referenced script does not exist: ${match[1]}`)
    }
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
  console.error(`Project script integrity: ${failures.length} failure(s) across ${checked} command entries.`)
  process.exit(1)
}
console.log(`PASS project script integrity: ${checked} command entries; no duplicate commands or missing local script references.`)
