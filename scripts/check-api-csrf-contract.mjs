#!/usr/bin/env node
/** Regression guard for middleware's same-origin mutation defense. */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'middleware.ts'), 'utf8')
const checks = [
  ['middleware is scoped to API routes', source.includes('matcher: ["/api/:path*"]')],
  ['safe methods are explicitly enumerated', /new Set\(\["GET", "HEAD", "OPTIONS"\]\)/.test(source)],
  ['webhook exception is explicit and narrow', /new Set\(\["\/api\/webhooks\/paystack"\]\)/.test(source)],
  ['origin is validated against request origin', source.includes('new URL(origin).origin !== request.nextUrl.origin')],
  ['malformed origin is rejected', source.includes('error: "INVALID_ORIGIN"')],
  ['cross-site fetch metadata is rejected', source.includes('fetchSite === "cross-site"')],
  ['mutation rejections are non-cacheable', source.includes('"Cache-Control": "no-store"')],
]
let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
console.log(`\nAPI CSRF contract checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
