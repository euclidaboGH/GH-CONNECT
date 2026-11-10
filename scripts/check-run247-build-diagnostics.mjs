#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')
const runner = readFileSync(join(root, 'scripts/run-prebuild-checks.mjs'), 'utf8')
const errors = []
let checks = 0
const check = (condition, label) => {
  checks += 1
  if (condition) console.log(`PASS ${label}`)
  else errors.push(label)
}

const commands = String(pkg.scripts?.['prebuild:checks'] ?? '').split(/\s*&&\s*/).map((item) => item.trim()).filter(Boolean)
const targets = commands.map((command) => command.split(/\s+/).find((token) => token.startsWith('scripts/')))
check(pkg.scripts?.prebuild === 'node scripts/run-prebuild-checks.mjs', 'npm prebuild uses the diagnostic runner')
check(commands.length >= 270, 'the complete legacy prebuild gate set is retained')
check(commands.every((command) => command.startsWith('node ')), 'prebuild commands are direct Node invocations')
check(targets.every((target) => target && target.endsWith('.mjs')), 'every prebuild command has a script target')
check(targets.every((target) => existsSync(join(root, target))), 'every prebuild script target exists')
check(runner.includes('spawnSync(process.execPath, item.args'), 'runner executes checks without a shell')
check(runner.includes('[prebuild] FAIL') && runner.includes('item.script'), 'runner reports the exact failing script')
check(runner.includes('process.versions.node') && runner.includes('pkg.engines?.node'), 'runner enforces the declared Node engine')
check(runner.includes('--list') && runner.includes('--dry-run'), 'runner supports a non-executing diagnostic list')
check(pkg.scripts?.['check:run247-build-diagnostics'] === 'node scripts/check-run247-build-diagnostics.mjs', 'focused Run 247 checker is registered')
check(pkg.scripts?.['verify:static']?.includes('check-run247-build-diagnostics.mjs'), 'focused Run 247 checker is part of static verification')
check(workflow.includes('actions/upload-artifact@v4') && workflow.includes('.next/trace'), 'CI preserves Next.js build traces on failure')
check(workflow.includes('npm config delete cache-dir --location=user'), 'CI removes stale user-level npm cache-dir config')
check(workflow.includes('npm --version'), 'CI records the npm toolchain version')
check(workflow.includes('if: failure()'), 'diagnostic artifact upload is failure-gated')

if (errors.length) {
  console.error(`\nRun 247 build diagnostics: ${errors.length}/${checks} failed`)
  errors.forEach((error) => console.error(`FAIL ${error}`))
  process.exit(1)
}
console.log(`\nRun 247 build diagnostics: ${checks}/${checks} passed; ${commands.length} prebuild commands preserved.`)
