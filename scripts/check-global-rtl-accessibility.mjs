import fs from 'node:fs'
import assert from 'node:assert/strict'

const read = (path) => fs.readFileSync(path, 'utf8')
const css = read('app/globals.css')
const skip = read('components/ghc/skip-to-content.tsx')
const app = read('components/ghc/app.tsx')
const shell = read('lib/i18n/shell.ts')
const regional = read('contexts/regional-context.tsx')
const formatting = read('lib/i18n/formatting.ts')
const notifications = read('components/ghc/notification-bell.tsx')
const governance = read('lib/i18n/review-governance.ts')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['keyboard skip link is locale-aware', skip.includes('getShellMessage("skipToContent", locale)') && app.includes('<SkipToContent locale={regional.locale} />')],
  ['skip link targets the main content landmark', skip.includes('#ghc-main-content') && app.includes('id="ghc-main-content"')],
  ['skip link is keyboard-revealed and uses logical positioning', css.includes('.gh-skip-to-content:focus') && css.includes('inset-inline-start')],
  ['shell skip-link copy exists in all four preview locales', ['skipToContent: "Tsallaka', 'skipToContent: "Gaa', 'skipToContent: "Fo sí', 'skipToContent: "Skip go'].every((part) => shell.includes(part))],
  ['RTL layout helpers use logical inline properties', ['margin-inline-start', 'margin-inline-end', 'padding-inline', 'border-inline-start', 'text-align: start'].every((part) => css.includes(part))],
  ['directional icon mirroring is opt-in', css.includes(':dir(rtl) .gh-directional-icon') && !css.includes(':dir(rtl) svg')],
  ['mixed-script numeric values are isolated', css.includes('.gh-bidi-number') && notifications.includes('<bdi className="gh-bidi-number">')],
  ['high contrast and forced-colors modes are supported', css.includes('@media (prefers-contrast: more)') && css.includes('@media (forced-colors: active)')],
  ['long text and mobile inputs support reflow', css.includes('.gh-readable-copy') && css.includes('.gh-long-value') && css.includes('max-width: 100%')],
  ['locale presentation reuses canonical direction resolver', formatting.includes('getLocaleDirection(canonical)') && !formatting.includes('function getDirection(')],
  ['catalog version 7 requires renewed review', governance.includes('currentCatalogVersion: "7"')],
  ['RTL accessibility gate is registered in prebuild and static verification', pkg.scripts['check:global-rtl-accessibility'] && pkg.scripts.prebuild.includes('check-global-rtl-accessibility') && pkg.scripts['verify:static'].includes('check-global-rtl-accessibility')],
]
for (const [name, passed] of checks) {
  assert.equal(passed, true, name)
  console.log(`PASS ${name}`)
}
console.log(`Global RTL/accessibility: ${checks.length}/${checks.length} passed`)
