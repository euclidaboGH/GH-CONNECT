#!/usr/bin/env node
/** RUN344: Pi sign-in failures must be diagnosable (token-free) and sandbox launch mistakes explained. */
import { readFileSync } from 'node:fs'

const runtime = readFileSync(new URL('../lib/pi-runtime.ts', import.meta.url), 'utf8')
const context = readFileSync(new URL('../contexts/pi-auth-context.tsx', import.meta.url), 'utf8')
const screen = readFileSync(new URL('../components/auth-loading-screen.tsx', import.meta.url), 'utf8')
const checks = [
  ['SDK rejection reason is sanitized, bounded and token-redacted', /export function sanitizePiAuthReason/.test(runtime) && /\.slice\(0, 80\)/.test(runtime) && /\[redacted\]/.test(runtime)],
  ['SDK rejection is classified into a bounded code', /export function classifyPiAuthReason/.test(runtime) && /GENERIC_SDK_REJECTION/.test(runtime)],
  ['non-Error SDK rejections keep a meaningful message', /throw err instanceof Error \? err : new Error\(reason \|\| "Pi rejected the authorization request"\)/.test(runtime)],
  ['rejection diagnostic records reason class and framing', /reasonClass: classifyPiAuthReason\(reason\)/.test(runtime) && /inIframe: isWindowFramed\(\)/.test(runtime)],
  ['token-free diagnostic contract is preserved', runtime.includes('Never include tokens, usernames, Pi UIDs, cookies, request bodies, or raw errors.')],
  ['diagnostic history is bounded and token-free', /PI_AUTH_HISTORY_MAX = 30/.test(runtime) && !/accessToken|Authorization|cookie/i.test((runtime.split('export function buildPiAuthDiagnosticReport')[1] || '').split('export function getPiSandboxLaunchHint')[0])],
  ['sandbox launch hint exists and only applies to unframed sandbox mode', /export function getPiSandboxLaunchHint/.test(runtime) && /if \(isPiSandboxFrame\(\) \|\| isWindowFramed\(\)\) return null/.test(runtime)],
  ['sign-in failure message appends the sandbox hint only for authenticate failures', /diagnosticCode === "PI_AUTHENTICATE_FAILED" \? getPiSandboxLaunchHint\(\)/.test(context)],
  ['error screen offers copyable diagnostics', /buildPiAuthDiagnosticReport/.test(screen) && /Copy sign-in diagnostics/.test(screen)],
  ['no local identity fallback introduced', !/PI_AUTH_PROMPT_REJECTED[\s\S]{0,900}continueLocalPreview/.test(runtime)],
]
let failures = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures++ }
console.log(`\nRUN344 Pi auth diagnostics UX: ${checks.length - failures}/${checks.length} passed`)
if (failures) process.exit(1)
