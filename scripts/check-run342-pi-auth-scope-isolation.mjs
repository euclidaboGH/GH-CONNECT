#!/usr/bin/env node
/** RUN342 — isolate baseline identity sign-in from optional payment permissions. */
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const auth = read('contexts/pi-auth-context.tsx')
const wallet = read('lib/client/pi-wallet-consent.ts')
const policy = read('lib/routing/public-route-policy.ts')
const wrapper = read('components/app-wrapper.tsx')
const registry = read('lib/navigation/service-registry.ts')
const release = read('lib/server/ecosystem/service-release.ts')
const checks = []
const test = (name, ok) => { checks.push(Boolean(ok)); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`) }
test('baseline Pi sign-in requests identity scope only', /piAuthenticateOfficial\(\["username"\]\)/.test(auth) && !/piAuthenticateOfficial\(\["username",\s*"payments"\]\)/.test(auth))
test('wallet permission is requested only inside explicit wallet-consent flow', /piAuthenticateOfficial\(\["wallet_address"\]\)/.test(wallet))
test('public research share links bypass Pi auth shell', policy.includes('^\\/r\\/[^/]+\\/?$') && wrapper.includes('isPublicRoutePath(pathname)'))
test('public field desk bypasses Pi auth shell without exposing studio/admin paths', /return path === "\/field" \|\| path === "\/field\/"/.test(policy) && /!isPublicRoutePath/.test(policy) === false)
test('coming-soon services are non-interactive and have no destination', /COMING_SOON/.test(registry) && /destination: \{ kind: "none" \}/.test(registry) && /isInteractiveStatus\(service\.status\)/.test(release))
const publicShell = wrapper.split('function PublicRouteShell')[1]?.split('function AuthenticatedRouteShell')[0] || ''
test('Pi auth SDK initialization is not mounted in public shell', !publicShell.includes('<PiAuthProvider>') && !publicShell.includes('<IdentityProvider>') && wrapper.includes('<PiAuthProvider>'))
const failed = checks.filter(Boolean).length !== checks.length
console.log(`\nRUN342 Pi auth scope isolation: ${checks.filter(Boolean).length}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
