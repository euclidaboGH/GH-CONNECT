#!/usr/bin/env node
/** RUN371: recognize Pi's app CDN iframe so the auth tap reaches Pi.authenticate without an async bridge probe. */
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const runtime = read('lib/pi-runtime.ts')
const context = read('contexts/pi-auth-context.tsx')
const authButton = read('components/auth/sign-in-with-pi-button.tsx')
const vercel = read('vercel.json')
const checks = [
  ['Sandbox recognition remains restricted to Testnet mode', /if \(typeof window === "undefined" \|\| !getPiSandbox\(\)\) return false/.test(runtime)],
  ['Sandbox recognition still requires an iframe', /let framed = false[\s\S]*?return framed && trustedSandboxReferrer/.test(runtime)],
  ['Pi sandbox host remains trusted', /referrerHost === "sandbox\.minepi\.com"/.test(runtime)],
  ['Pi app CDN iframe host is recognized', /referrerHost === "app-cdn\.minepi\.com"/.test(runtime)],
  ['CDN recognition is exact-host rather than broad minepi.com matching', !/referrerHost\.endsWith\("\.minepi\.com"\)/.test(runtime)],
  ['Recognized Sandbox iframe skips the asynchronous App Studio credential probe', /const sandboxFrame = isPiSandboxFrame\(\)[\s\S]*?const parentCredentials = sandboxFrame \? null : await requestParentCredentials\(\)/.test(context)],
  ['Sandbox bootstrap preinitializes SDK before the explicit sign-in tap', /isPiSandboxFrame\(\)[\s\S]{0,260}ensurePiInitialized\(\)/.test(context)],
  ['Sign-in button routes recognized Pi iframe to provider retry', /isPiBrowserRuntime\(\) \|\| isPiSandboxFrame\(\)/.test(authButton) && /await reinitialize\(\)/.test(authButton)],
  ['Official auth remains username-only and server verification is preserved', /piAuthenticateOfficial\(\["username"\]\)/.test(context) && /verifyPiAccessTokenDetailed\(accessToken\)/.test(read('app/api/auth/pi/route.ts'))],
  ['CSP permits the configured Pi SDKLite script CDNs', /script-src[^;]*https:\/\/pi-apps\.github\.io/.test(vercel) && /script-src[^;]*https:\/\/cdn\.jsdelivr\.net/.test(vercel) && /script-src[^;]*https:\/\/sdk\.minepi\.com/.test(vercel)],
  ['CSP permits the configured Pi plugin backend API origin', /connect-src[^;]*https:\/\/backend\.appstudio-u7cm9zhmha0ruwv8\.piappengine\.com/.test(vercel)],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed++
}
console.log(`\nRUN371 Pi CDN Sandbox gesture contract: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
