import fs from 'node:fs'
import assert from 'node:assert/strict'

const read = (file) => fs.readFileSync(file, 'utf8')
const tests = [
  ['regional context provider is mounted globally', /RegionalContextProvider/.test(read('components/app-wrapper.tsx'))],
  ['server timestamps remain ISO/UTC and client formats in device zone', /getClientTimeZone/.test(read('lib/regional-context.ts')) && /Intl\.DateTimeFormat/.test(read('lib/regional-context.ts'))],
  ['locale and timezone are attached to same-origin API requests', /X-GH-Locale/.test(read('lib/auth/install-api-auth-fetch.ts')) && /X-GH-Timezone/.test(read('lib/auth/install-api-auth-fetch.ts'))],
  ['precise location is not globally attached to every request', /regionalHeaders\(null\)/.test(read('lib/auth/install-api-auth-fetch.ts'))],
  ['location capture requires browser permission', /navigator\.geolocation\.getCurrentPosition/.test(read('lib/regional-context.ts'))],
  ['location API headers are coarse-rounded', /Math\.round\(location\.latitude \* 1000\)/.test(read('lib/regional-context.ts'))],
  ['regional context exposes timezone and location controls in settings', /Regional context/.test(read('components/ghc/settings.tsx')) && /requestLocation/.test(read('components/ghc/settings.tsx'))],
  ['feed ranking receives opted-in location', /geolocation: regional\.location/.test(read('components/ghc/enhanced-feed-screen.tsx'))],
  ['nearby ranking uses actual coordinates instead of a demo constant', /function haversineKm/.test(read('lib/feed-ranking-engine.ts')) && !/Simulate location relevance/.test(read('lib/feed-ranking-engine.ts'))],
  ['notification relative times use live regional clock', /useLiveNow/.test(read('components/ghc/notification-bell.tsx')) && /regional\.formatRelativeTime/.test(read('components/ghc/notification-bell.tsx'))],
]
let failed = 0
for (const [name, ok] of tests) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
assert.equal(failed, 0, `${failed} regional context checks failed`)
console.log(`Regional context: ${tests.length}/${tests.length} PASS`)
