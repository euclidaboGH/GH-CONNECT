#!/usr/bin/env node
/** Regression guard for deployment-wide browser security headers. */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))
const globalRule = config.headers?.find((rule) => rule.source === '/(.*)')
const headers = new Map((globalRule?.headers ?? []).map(({ key, value }) => [key.toLowerCase(), value]))
const checks = [
  ['content type sniffing disabled', headers.get('x-content-type-options') === 'nosniff'],
  ['referrer policy is restrictive', headers.get('referrer-policy') === 'strict-origin-when-cross-origin'],
  ['frame ancestors remain compatible with Pi Browser embedding', (headers.get('content-security-policy') ?? '').includes('frame-ancestors') && (headers.get('content-security-policy') ?? '').includes('sandbox.minepi.com')],
  ['HTTPS transport is pinned for one year', /^max-age=31536000(?:;|$)/.test(headers.get('strict-transport-security') ?? '')],
  ['legacy cross-domain policy files disabled', headers.get('x-permitted-cross-domain-policies') === 'none'],
  ['download execution protection present', headers.get('x-download-options') === 'noopen'],
  ['permissions policy is explicitly configured', Boolean(headers.get('permissions-policy'))],
]
let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
console.log(`\nSecurity-header regression checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
