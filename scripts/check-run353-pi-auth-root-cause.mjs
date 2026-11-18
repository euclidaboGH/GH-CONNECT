#!/usr/bin/env node
/** RUN353: Sandbox frame reconciliation and user-gesture-safe Pi authentication. */
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const runtime = read('lib/pi-runtime.ts')
const context = read('contexts/pi-auth-context.tsx')
const screen = read('components/auth-loading-screen.tsx')
const route = read('app/api/auth/pi/route.ts')
const piAdapter = read('lib/pi.ts')
const checks = [
  ['Sandbox frame recognition requires Testnet mode, iframe and trusted Sandbox referrer', /export function isPiSandboxFrame\(\)[\s\S]*?getPiSandbox\(\)[\s\S]*?window\.self !== window\.top[\s\S]*?referrerHost === "sandbox\.minepi\.com"/.test(runtime)],
  ['Sandbox warning and diagnostic report share the same frame evidence', /getPiSandboxLaunchHint[\s\S]*?isPiSandboxFrame\(\) \|\| isWindowFramed\(\)/.test(runtime) && /sandboxFrame=\$\{snap\.sandboxFrame\}/.test(runtime)],
  ['Runtime report exposes origin, referrer host and frame state without credentials', /origin: typeof window !== "undefined" \? window\.location\.origin : null/.test(runtime) && /referrerHost: getReferrerHost\(\)/.test(runtime) && /inIframe: typeof window !== "undefined" \? isWindowFramed\(\) : false/.test(runtime)],
  ['Sandbox bootstrap initializes SDK but waits for explicit user action before authenticate', /if \(isPiSandboxFrame\(\)\) \{[\s\S]*?ensurePiInitialized\(\)\.then[\s\S]*?Pi Sandbox is ready\. Tap Sign in with Pi[\s\S]*?return \(\) => \{ cancelled = true \}/.test(context)],
  ['Signed-out Sandbox sessions also preload before exposing sign-in', /if \(readSignedOutFlag\(\)\) \{[\s\S]*?setHasError\(false\)[\s\S]*?ensurePiInitialized\(\)\.then/.test(context)],
  ['Sandbox frame bypasses unrelated App Studio parent credential probe', /const sandboxFrame = isPiSandboxFrame\(\)[\s\S]*?const parentCredentials = sandboxFrame \? null : await requestParentCredentials\(\)/.test(context)],
  ['Already-initialized Pi SDK invokes authenticate without an intervening await', /if \(!initialized \|\| !getWindowPi\(\)\) \{\s*return ensurePiInitialized\(\)\.then\(\(\) => piAuthenticateOfficial\(scopes\)\)\s*\}[\s\S]*?const authPromise = authenticate\(scopes/.test(runtime)],
  ['Authentication invocation records transient user-activation evidence', /PI_AUTH_INVOKE_CONTEXT/.test(runtime) && /userActivationActive: isUserActivationActive\(\)/.test(runtime)],
  ['Verified sign-in does not trigger a second Pi login during optional commerce setup', /Pioneer has already authenticated through the official Pi/.test(context) && !/await pi\.auth\.login\(\);\s*await sdkLite\.login\(\);/.test(context)],
  ['Legacy SDK adapter no longer launches a second payments-scope Pi.authenticate prompt', !/wPi\.authenticate\(\["username",\s*"payments"\]/.test(piAdapter)],
  ['Normal identity sign-in remains username-only', /piAuthenticateOfficial\(\["username"\]\)/.test(context)],
  ['Server identity verification remains mandatory and access token is sent to Pi /me', /caller must POST accessToken to \/api\/auth\/pi for verification/.test(runtime) && /verifyPiAccessTokenDetailed\(accessToken\)/.test(route) && /GET \/v2\/me|\/v2\/me/.test(read('lib/server/economy/auth.ts'))],
  ['Sandbox path does not enable local identity fallback', /if \(host\.endsWith\("\.vercel\.app"\)\) return false/.test(read('lib/system-config.ts'))],
  ['Auth UI routes Sandbox sign-in through the Pi SDK on explicit tap', /isPiBrowserRuntime\(\) \|\| isPiSandboxFrame\(\)/.test(read('components/auth/sign-in-with-pi-button.tsx')) && /SignInWithPiButton/.test(screen)],
  ['Retry action remains available after an authentication rejection', /Retry Pi authentication/.test(screen)],
  ['No server-side Pi API key is exposed by client runtime', !/(?:const|let|var)\s+PI_API_KEY\s*=/.test(runtime)],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed++
}
console.log(`\nRUN353 Pi authentication root-cause regression: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
