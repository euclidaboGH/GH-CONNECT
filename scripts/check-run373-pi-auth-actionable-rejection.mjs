#!/usr/bin/env node
/** RUN373: make the observed generic Pi SDK rejection actionable without weakening auth. */
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const context = read('contexts/pi-auth-context.tsx')
const runtime = read('lib/pi-runtime.ts')
const auth = read('app/api/auth/pi/route.ts')
const checks = [
  ['generic SDK rejection is recognized explicitly', context.includes('if (/^authentication failed\\.?$/i.test(raw) && inPi)')],
  ['Sandbox-specific guidance checks the trusted Sandbox frame', /if \(isPiSandboxFrame\(\)\)/.test(context)],
  ['Sandbox guidance names Testnet registration and Pi Utilities authorization', /registered for Testnet[\s\S]*exact hosted URL[\s\S]*authorized in Pi Utilities/.test(context)],
  ['guidance states failure occurs before an access token reaches GreenHaven', /before GreenHaven received an access token/.test(context)],
  ['ordinary login remains username-only', /piAuthenticateOfficial\(\[\"username\"\]\)/.test(context)],
  ['server-side Pi /me verification remains mandatory', /verifyPiAccessTokenDetailed\(accessToken\)/.test(auth)],
  ['no local identity fallback is introduced for production auth', !/PI_AUTH_PROMPT_REJECTED[\s\S]{0,900}continueLocalPreview/.test(runtime)],
  ['diagnostics remain token-free', runtime.includes('Never include tokens, usernames, Pi UIDs, cookies, request bodies, or raw errors.')],
]
let failures = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures++ }
console.log(`\nRUN373 Pi auth actionable rejection: ${checks.length - failures}/${checks.length} passed`)
if (failures) process.exit(1)
