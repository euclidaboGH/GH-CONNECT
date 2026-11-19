#!/usr/bin/env node
/** RUN370: Pi SDK auth rejection diagnostics expose safe machine metadata without leaking credentials. */
import { readFileSync } from 'node:fs'
const runtime = readFileSync(new URL('../lib/pi-runtime.ts', import.meta.url), 'utf8')
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const checks = [
  ['SDK rejection reason prefers machine-readable code/reason before generic message', /candidates = \[o\.code, o\.errorCode, o\.reason, o\.error, o\.message\]/.test(runtime)],
  ['nested SDK response metadata is inspected only one level deep', /for \(const nestedKey of \["data", "response", "cause"\]\)/.test(runtime) && /depth > 1/.test(runtime)],
  ['only allow-listed error field names are reported', /const allowed = new Set\(\["name", "message", "code", "errorCode", "reason", "error", "status", "statusCode", "data", "response", "cause"\]\)/.test(runtime)],
  ['SDK code and HTTP status are format- and range-bounded', /sdkErrorCode: details\.sdkErrorCode && \//.test(runtime) && /sdkErrorStatus: Number\.isInteger\(details\.sdkErrorStatus\)/.test(runtime)],
  ['rejection diagnostic includes safe SDK metadata', /const metadata = getPiAuthErrorMetadata\(err\)/.test(runtime) && /sdkErrorFields: metadata\.fields/.test(runtime)],
  ['raw errors, access tokens and response bodies are never serialized', !/JSON\.stringify\(err\)|JSON\.stringify\(metadata\)/.test(runtime) && /Never include tokens, usernames, Pi UIDs, cookies, request bodies, or raw errors/.test(runtime)],
  ['RUN370 regression gate is registered in prebuild and static verification', ['prebuild:checks','verify:static'].every((k) => pkg.scripts[k]?.includes('check-run370-pi-auth-rejection-metadata.mjs'))],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nRUN370 Pi auth rejection metadata: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
