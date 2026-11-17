#!/usr/bin/env node
/** Backward-compatible command for the canonical, classified migration inventory. */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const result = spawnSync(process.execPath, [join(root, 'scripts', 'generate-migration-inventory.mjs'), '--list'], {
  cwd: root,
  stdio: 'inherit',
})
if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}
process.exit(result.status ?? 1)
