#!/usr/bin/env node
/** RUN372: suspended research routes are not public and are blocked at middleware. */
import { readFileSync } from 'node:fs'
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const policy = read('lib/routing/public-route-policy.ts')
const wrapper = read('components/app-wrapper.tsx')
const layout = read('app/layout.tsx')
const checks = [
  ['research share links are not allowlisted as public routes', !policy.includes('^\\/r\\/[^/]+\\/?$')],
  ['field intake desk is not allowlisted as a public route', !policy.includes('return path === "/field"')],
  ['Field Research Studio is not publicly allowlisted', !policy.includes('startsWith("/field"')],
  ['Field admin routes are not publicly allowlisted', !policy.includes('\"/field/admin')],
  ['AppWrapper selects public shell before mounting auth providers', wrapper.includes('isPublicRoutePath(pathname)') && wrapper.includes('<PublicRouteShell>') && wrapper.includes('<AuthenticatedRouteShell>')],
  ['public shell does not mount Pi or identity providers', wrapper.includes('function PublicRouteShell') && !wrapper.split('function PublicRouteShell')[1].split('function AuthenticatedRouteShell')[0].includes('<PiAuthProvider')],
  ['Pi SDK is no longer loaded globally in root layout', !layout.includes('sdk.minepi.com/pi-sdk.js') && !layout.includes('next/script')],
  ['authenticated Pi runtime retains on-demand SDK loading', read('lib/pi-runtime.ts').includes('PI_NETWORK_CONFIG.SDK_URL')],
  ['research page routes are edge-blocked before handler execution', read('middleware.ts').includes('isResearchPage') && read('middleware.ts').includes('path.startsWith("/r/")')],
  ['research and field APIs are edge-blocked before handler execution', read('middleware.ts').includes('isResearchApi') && read('middleware.ts').includes('path.startsWith("/api/research/")') && read('middleware.ts').includes('path.startsWith("/api/field/")')],
  ['Pi auth route records token-free request arrival telemetry', read('app/api/auth/pi/route.ts').includes('auth.pi.request_received') && read('app/api/auth/pi/route.ts').includes('originPresent')],
  ['middleware logs cross-origin Pi auth blocks with correlation IDs only', read('middleware.ts').includes('isPiAuthRoute: path === "/api/auth/pi"') && read('middleware.ts').includes('ORIGIN_MISMATCH') && !/accessToken|authorization/i.test(read('middleware.ts'))],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed += 1 }
console.log(`\nPhase 1 public route boundary: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
