import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const css = read('app/globals.css')
const ds = read('lib/design-system.ts')
const brandLogo = read('components/ghc/brand-logo.tsx')
const coinLogo = read('components/ghc/ghc-coin-icon.tsx')
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')
const checks = [
  ['package and lockfile versions agree', lock.version === pkg.version && lock.packages?.['']?.version === pkg.version],
  ['release constant matches package version', read('lib/app-release.ts').includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['light theme has semantic success, warning, danger and info tokens', ['--gh-success:', '--gh-warning:', '--gh-danger:', '--gh-info:'].every((token) => css.includes(token))],
  ['dark theme overrides semantic status colors and surfaces', /\.dark\s*\{[^}]*--gh-success:[^}]*--gh-success-bg:[^}]*--gh-warning:[^}]*--gh-warning-bg:[^}]*--gh-danger:[^}]*--gh-danger-bg:[^}]*--gh-info:[^}]*--gh-info-bg:/s.test(css)],
  ['semantic status classes exist for all four states', ['gh-status-success', 'gh-status-warning', 'gh-status-danger', 'gh-status-info'].every((token) => css.includes(token))],
  ['empty state and skeleton feedback primitives exist', css.includes('.gh-empty-state') && css.includes('.gh-skeleton')],
  ['skeleton motion respects reduced-motion preference', /prefers-reduced-motion:\s*reduce[^}]*\.gh-skeleton::after\s*\{\s*animation:\s*none/s.test(css)],
  ['shared status class exports exist', ['success:', 'warning:', 'danger:', 'info:'].every((token) => ds.includes(token)) && ds.includes('export const statusClass')],
  ['shared feedback and motion token exports exist', ds.includes('export const feedbackClass') && ds.includes('export const motion')],
  ['focus-visible interaction affordance is defined', css.includes('.gh-btn:focus-visible') && css.includes('outline-offset: 3px')],
  ['touch control height remains at least 44px', /--gh-control-height:\s*2\.75rem/.test(css)],
  ['canonical content width is not redeclared in the refinement layer', (css.match(/:root\s*\{[^}]*--gh-content-max:/s)?.[0].match(/--gh-content-max:/g) || []).length === 1],
  ['Phase 5 design system documentation exists', fs.existsSync(path.join(root, 'docs/PHASE-05-BRANDING-DESIGN-SYSTEM.md'))],

  ['official GreenHaven logo asset is unchanged', sha256('public/gh-connect-logo.png') === 'f0743efcc50fbdf98b5591c6b2c704c544c6adb38e3e5b611fc04d9d7ce8ca13'],
  ['official GHC coin logo asset is unchanged', sha256('public/ghc-coin-logo.png') === 'fb9f896523aa41d2c9fc39c01bbbab514b76a2533f4c8c6802fbe37e69bd7d78'],
  ['official GHC responsive coin assets are unchanged', sha256('public/ghc-coin-64.png') === '3bd2fe1b4f83240a820085535c46eef0702a7ba26f360437475d91fc5e1e53d3' && sha256('public/ghc-coin-32.png') === 'd791fcf81044640d98d49221c8e80853a2afa1eacdcb94c893dc33982c2b6a4f'],
  ['shared GreenHaven logo uses canonical brand asset constant', brandLogo.includes('src={brandAssets.greenHavenLogo}') && ds.includes('greenHavenLogo: "/gh-connect-logo.png"')],
  ['shared GHC coin component uses canonical asset constants', coinLogo.includes('brandAssets.ghcCoinLogo') && coinLogo.includes('brandAssets.ghcCoinMedium') && ds.includes('ghcCoinSmall: "/ghc-coin-32.png"')],
  ['responsive gutters respect device safe areas', css.includes('env(safe-area-inset-left, 0px)') && css.includes('env(safe-area-inset-right, 0px)')],
  ['forced-colors mode preserves status and focus visibility', css.includes('@media (forced-colors: active)') && css.includes('outline: 2px solid Highlight')],
  ['increased-contrast preference strengthens status feedback', css.includes('@media (prefers-contrast: more)') && css.includes('.gh-status { border-width: 2px;')],
  ['design system exports brand and accessibility contracts', ds.includes('export const brandAssets') && ds.includes('minimumTouchTargetPx: 44')],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`Phase 5 design-system checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
