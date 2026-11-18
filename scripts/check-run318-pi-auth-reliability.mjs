#!/usr/bin/env node
/** Run 318 — Pi authentication reliability regression contract. */
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const auth = read('lib/server/economy/auth.ts')
const route = read('app/api/auth/pi/route.ts')
const client = read('contexts/pi-auth-context.tsx')
const checks = []
const test = (name, ok) => { checks.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`) }
test('Pi 401/403 is distinguished from upstream errors', /res\.status === 401 \|\| res\.status === 403/.test(auth) && /reason: "INVALID_TOKEN"/.test(auth))
test('Pi 429/5xx/network failures are retryable, not invalid credentials', /res\.status === 429 \|\| res\.status >= 500/.test(auth) && /reason: "PI_UNAVAILABLE"/.test(auth))
test('Pi response JSON/UID shape is validated before identity use', /INVALID_PI_RESPONSE/.test(auth) && /typeof uid !== "string" \|\| !uid\.trim\(\)/.test(auth))
test('legacy verifier preserves nullable contract for existing callers', /export async function verifyPiAccessToken\(/.test(auth) && /return result\.ok \? result\.user : null/.test(auth))
test('Pi auth bridge returns retryable 503 for Platform outage', /PI_VERIFICATION_UNAVAILABLE/.test(route) && /status: unavailable \? 503/.test(route))
test('Pi auth bridge never maps an upstream outage to INVALID_PI_TOKEN', /verification\.reason === "INVALID_PI_RESPONSE"/.test(route) && /: "INVALID_PI_TOKEN"/.test(route))
test('auth bridge preserves no-store on verification failure', /headers: \{ "Cache-Control": "no-store" \}/.test(route))
test('client prevents overlapping Pi authentication attempts', /authAttemptRef\.current\) return/.test(client) && /authAttemptRef\.current = false/.test(client))
test('client handles 503 separately from generic 5xx', /bridgeRes\.status >= 500 && bridgeRes\.status !== 503/.test(client))
test('client honors server rate-limit retry guidance', /bridgeRes\.status === 429/.test(client) && /Retry-After/.test(client))
test('Pi tokens are not written to diagnostic logs', !/console\.(log|info|warn|error)\([^\n]*accessToken/.test(client + route))
const failed = checks.filter(x => !x).length
console.log(`\nRun 318 Pi authentication reliability: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
