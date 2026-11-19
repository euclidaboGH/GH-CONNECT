import fs from 'node:fs'
import assert from 'node:assert/strict'

const spec = fs.readFileSync('e2e/phase5-runtime-acceptance.spec.ts', 'utf8')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const release = fs.readFileSync('lib/app-release.ts', 'utf8')
const required = [
  'GHC_E2E_PHASE5', 'GHC_E2E_ALLOW_TESTNET', 'isProdTarget', 'PI_NETWORK',
  'NEXT_PUBLIC_PI_SANDBOX', '320, 360, 390, 430, 768, 1024, 1280, 1440',
  'largest-contentful-paint', 'usedJsHeapBytes', 'transferBytes',
  'Promise.all', '/api/social/feed?limit=10', 'not.toContain(500)',
]
for (const token of required) assert.ok(spec.includes(token), `Phase 5 browser harness missing ${token}`)
assert.equal(pkg.scripts['test:e2e:phase5'], 'playwright test e2e/phase5-runtime-acceptance.spec.ts')
assert.ok(release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`), 'release identity must match package.json')
assert.match(release, /configuration, package metadata and component security review/i)
console.log(`Phase 5 runtime acceptance guard: ${required.length + 3}/${required.length + 3} checks passed`)
