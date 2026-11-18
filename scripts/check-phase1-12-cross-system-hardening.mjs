#!/usr/bin/env node
/** Network/DB-independent cross-phase request-boundary regression checks. */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(join(root, file), 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const helper = read('lib/server/http/read-bounded-json.ts')
const routes = [
  ['app/api/account/lifecycle/route.ts', '4 * 1024', 'account export/deletion request intake'],
  ['app/api/marketplace/listings/route.ts', '12 * 1024 * 1024', 'seller listing mutation with bounded media payloads'],
  ['app/api/social/posts/route.ts', '12 * 1024 * 1024', 'social post creation with bounded media payloads'],
  ['app/api/notifications/route.ts', '16 * 1024', 'notification bulk-read mutation'],
  ['app/api/communities/route.ts', '16 * 1024', 'community creation mutation'],
  ['app/api/marketplace/saves/route.ts', '8 * 1024', 'marketplace save mutation'],
  ['app/api/social/posts/[id]/comments/route.ts', '24 * 1024', 'comment creation with bounded attachment metadata'],
]
const checks = [
  ['release/package/lock/app metadata versions agree', lock.version === pkg.version && lock.packages?.['']?.version === pkg.version && read('lib/app-release.ts').includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['shared JSON reader checks declared and streamed byte limits', /content-length/.test(helper) && /totalBytes > maxBytes/.test(helper)],
  ['shared JSON reader uses fatal UTF-8 and rejects non-object JSON', /fatal: true/.test(helper) && /Array\.isArray\(value\)/.test(helper)],
  ['shared JSON reader bounds bytes before JSON.parse', helper.indexOf('totalBytes > maxBytes') >= 0 && helper.indexOf('totalBytes > maxBytes') < helper.indexOf('JSON.parse(raw)')],
  ...routes.map(([file, limit, label]) => [ `${label} uses streaming bounded JSON (${limit} bytes) and rejects invalid/oversized bodies`, read(file).includes('readBoundedJson') && read(file).includes(`readBoundedJson(request, ${limit})`) && /REQUEST_TOO_LARGE/.test(read(file)) && /INVALID_JSON|INVALID_BODY/.test(helper) ]),
  ['cross-system hardening check is registered in static verification', read('scripts/verify-phase14-static.mjs').includes('check-phase1-12-cross-system-hardening.mjs')],
  ['cross-system hardening report records runtime and live-system limits', /source-level|source only/i.test(read('docs/UPGRADE-WORKLOG-0.157.13.md')) && /Node\.js 24\.15\.0/.test(read('docs/UPGRADE-WORKLOG-0.157.13.md'))],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 1–12 cross-system hardening: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
