#!/usr/bin/env node
import { isPublicRoutePath } from '../lib/routing/public-route-policy.ts'
const cases = [
  ['root app remains authenticated', '/', false],
  ['privacy page remains public', '/privacy', true],
  ['survey slug is public', '/r/survey-opaque-slug', true],
  ['survey trailing slash is public', '/r/survey-opaque-slug/', true],
  ['nested survey path is not public', '/r/survey-opaque-slug/edit', false],
  ['field desk is public', '/field', true],
  ['field desk trailing slash is public', '/field/', true],
  ['research studio remains authenticated', '/field/studio', false],
  ['field admin evidence remains authenticated', '/field/admin/evidence', false],
  ['field lookalike remains authenticated', '/fielding', false],
]
let failed = 0
for (const [name, path, expected] of cases) {
  const actual = isPublicRoutePath(path)
  const ok = actual === expected
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${path} => ${actual}`)
  if (!ok) failed += 1
}
console.log(`\nPublic route policy behavior: ${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
