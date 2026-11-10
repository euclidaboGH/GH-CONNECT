#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { parseNodeScriptCommands } from './lib/prebuild-command-contract.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const raw = pkg.scripts?.['prebuild:checks']
if (typeof raw !== 'string' || !raw.trim()) {
  console.error('[prebuild] Missing package.json script "prebuild:checks".')
  process.exit(1)
}

let parsed
try {
  parsed = parseNodeScriptCommands(raw, {
    root,
    existsSync: (path) => existsSync(path),
  })
} catch (error) {
  console.error(`[prebuild] Invalid check manifest: ${error instanceof Error ? error.message : 'unknown error'}`)
  process.exit(1)
}

if (process.argv.includes('--list') || process.argv.includes('--dry-run')) {
  parsed.forEach(({ command }, index) => console.log(`${String(index + 1).padStart(3, '0')}/${parsed.length} ${command}`))
  console.log(`[prebuild] ${parsed.length} checks discovered; dry-run only.`)
  process.exit(0)
}

const engine = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(pkg.engines?.node ?? '')
if (!engine) {
  console.error('[prebuild] package.json must declare a caret-pinned Node engine such as ^24.15.0.')
  process.exit(1)
}
const actual = process.versions.node.split('.').map(Number)
const required = engine.slice(1).map(Number)
if (actual[0] !== required[0] || actual[1] < required[1] || (actual[1] === required[1] && actual[2] < required[2])) {
  console.error(`[prebuild] Unsupported Node.js ${process.versions.node}; this project requires ${pkg.engines.node}.`)
  process.exit(1)
}

console.log(`[prebuild] Node ${process.versions.node}; executing ${parsed.length} checks in declared order.`)
for (let index = 0; index < parsed.length; index += 1) {
  const item = parsed[index]
  console.log(`\n[prebuild ${String(index + 1).padStart(3, '0')}/${parsed.length}] ${item.command}`)
  const result = spawnSync(process.execPath, item.args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  })
  if (result.error) {
    console.error(`[prebuild] FAIL ${index + 1}/${parsed.length}: ${item.script}: ${result.error.message}`)
    process.exit(1)
  }
  if (result.status !== 0) {
    const status = result.status === null ? `signal ${result.signal ?? 'unknown'}` : `exit ${result.status}`
    console.error(`[prebuild] FAIL ${index + 1}/${parsed.length}: ${item.script} (${status})`)
    process.exit(result.status && result.status > 0 ? result.status : 1)
  }
}
console.log(`\n[prebuild] PASS: all ${parsed.length} checks completed.`)
