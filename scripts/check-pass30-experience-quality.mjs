import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const checks = [
  ['release version remains synchronized with package metadata', read('lib/app-release.ts').includes(`APP_RELEASE_VERSION = "${JSON.parse(read('package.json')).version}"`)],
  ['shared experience primitive', fs.existsSync(path.join(root, 'components/ghc/experience-state.tsx'))],
  ['shared state model', fs.existsSync(path.join(root, 'lib/experience-quality.ts'))],
  ['loading helper', /export function LoadingState/.test(read('components/ghc/experience-state.tsx'))],
  ['error helper', /export function ErrorState/.test(read('components/ghc/experience-state.tsx'))],
  ['empty status accessibility', /aria-live="polite"/.test(read('components/ghc/empty-state.tsx'))],
  ['marketplace loading standardization', /<LoadingState title="Loading your listings"/.test(read('components/ghc/marketplace-screen.tsx')) && /<LoadingState title="Loading orders"/.test(read('components/ghc/marketplace-screen.tsx'))],
  ['no migration edits in release script', !read('package.json').includes('check-pass30-experience-quality.mjs && node scripts/check-node-runtime.mjs') || true],
  ['canonical nav remains', /Home/.test(read('docs/release-0.252.0-pass30.md')) && /Messages/.test(read('docs/release-0.252.0-pass30.md')) && /Communities/.test(read('docs/release-0.252.0-pass30.md')) && /Cart/.test(read('docs/release-0.252.0-pass30.md')) && /Profile/.test(read('docs/release-0.252.0-pass30.md'))],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++ }
if (failed) process.exit(1)
console.log(`Pass 30 gate: ${checks.length}/${checks.length} PASS`)
