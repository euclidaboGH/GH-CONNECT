#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseNodeScriptCommands, hasNodeScript } from './lib/prebuild-command-contract.mjs'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))
const runner = readFileSync(join(root, 'scripts/run-prebuild-checks.mjs'), 'utf8')
const closure = readFileSync(join(root, 'scripts/check-phase10-release-closure.mjs'), 'utf8')
const prebuild = pkg.scripts?.prebuild ?? ''
const manifest = pkg.scripts?.['prebuild:checks'] ?? ''
const verify = pkg.scripts?.['verify:static'] ?? ''
const options = { root, existsSync }
const checks = []
const check = (name, condition) => {
  checks.push(Boolean(condition))
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`)
}

let parsed = []
try { parsed = parseNodeScriptCommands(manifest, options) } catch (error) {
  console.error(`FAIL prebuild manifest parses: ${error instanceof Error ? error.message : 'unknown error'}`)
}

const required = [
  'scripts/check-release-hygiene.mjs',
  'scripts/check-project-truth.mjs',
  'scripts/check-phase10-release-closure.mjs',
  'scripts/check-phase10-platform-acceptance.mjs',
  'scripts/check-phase24-release-review.mjs',
]

check('prebuild delegates to the diagnostic runner', prebuild === 'node scripts/run-prebuild-checks.mjs')
check('prebuild manifest contains at least 270 legacy checks', parsed.length >= 270)
check('all prebuild commands are direct Node invocations', parsed.every((item) => item.command.startsWith('node ')))
check('all declared prebuild script targets exist', parsed.every((item) => existsSync(join(root, item.script))))
check('runner imports the shared command-contract parser', runner.includes("from './lib/prebuild-command-contract.mjs'"))
check('runner executes checks without a shell', runner.includes('spawnSync(process.execPath, item.args') && !/shell:\s*true/.test(runner))
check('shared parser rejects shell metacharacters', (() => { try { parseNodeScriptCommands('node scripts/a.mjs; echo bad', options); return false } catch { return true } })())
check('shared parser rejects path traversal', (() => { try { parseNodeScriptCommands('node scripts/../secret.mjs', options); return false } catch { return true } })())
check('shared parser rejects missing script targets', (() => { try { parseNodeScriptCommands('node scripts/not-present-run248.mjs', options); return false } catch { return true } })())
check('shared parser rejects empty command entries', (() => { try { parseNodeScriptCommands('node scripts/a.mjs &&  && node scripts/b.mjs', options); return false } catch { return true } })())
check('shared parser supports Node runtime flags before script target', (() => { try { return parseNodeScriptCommands('node --disable-warning=ExperimentalWarning --experimental-strip-types scripts/check-run248-release-gate-runner.mjs', options)[0]?.script === 'scripts/check-run248-release-gate-runner.mjs' } catch { return false } })())
check('release closure reads the declared prebuild manifest', closure.includes("pkg.scripts?.['prebuild:checks']") && closure.includes('prebuildHas'))
check('all five release controls remain in prebuild manifest', required.every((script) => hasNodeScript(manifest, script, options)))
check('all five release controls remain in static verification', required.every((script) => hasNodeScript(verify, script, options)))
const parityChecks = [
  'scripts/check-phase2-visual-cohesion.mjs',
  'scripts/check-pass16-social-loop.mjs',
  'scripts/check-run269-client-table-write-acl.mjs',
]
check('prebuild visual and database ACL checks are mirrored in static verification', parityChecks.every((script) => hasNodeScript(manifest, script, options) && hasNodeScript(verify, script, options)))
check('Vercel build shell clears injected npm cache-dir configuration after cache preparation', /prepare-vercel-build\.mjs && unset npm_config_cache_dir NPM_CONFIG_CACHE_DIR && npm run build/.test(vercel.buildCommand ?? ''))

const passed = checks.filter(Boolean).length
console.log(`\nRun 248 release-gate runner contract: ${passed}/${checks.length} passed; ${parsed.length} prebuild checks retained.`)
if (passed !== checks.length) process.exit(1)
