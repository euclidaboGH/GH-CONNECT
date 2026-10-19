import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const read = (p) => fs.readFileSync(path.resolve(p), 'utf8')
const css = read('app/globals.css')
const layout = read('app/layout.tsx')
const errorPage = read('app/error.tsx')
const themes = read('lib/theme/themes.ts')
const appShell = read('components/ghc/app.tsx')

const checks = [
  ['premium design tokens are defined', /--gh-ref-canvas:\s*#f6f8f7/.test(css) && /--gh-motion-standard/.test(css)],
  ['dark mode has distinct canvas and surface tokens', /\.dark\s*\{[^}]*--gh-ref-canvas:\s*#0a100d;[^}]*--gh-ref-surface:\s*#111a15;/s.test(css)],
  ['violet and ocean theme variants remain supported', /data-theme="violet-bloom"/.test(css) && /data-theme="ocean-breeze"/.test(css)],
  ['sunset theme has readable light/dark surface variants', /data-theme="sunset-gold"/.test(css) && /:root\.dark\[data-theme="sunset-gold"\]/.test(css)],
  ['shared focus-visible styles exist for keyboard users', /:where\(button, a, input, textarea, select, \[role="button"\], \[tabindex\]\):focus-visible/.test(css)],
  ['form controls have shared focus affordances', /box-shadow:\s*0 0 0 3px color-mix\(in srgb, var\(--primary\) 13%, transparent\)/.test(css)],
  ['reduced-motion preferences are respected', /@media \(prefers-reduced-motion: reduce\)/.test(css)],
  ['safe-area aware bottom navigation remains in place', /env\(safe-area-inset-bottom, 0px\)/.test(css) && /\.gh-bottom-nav/.test(css)],
  ['responsive desktop feed widths are defined', /@media \(min-width: 1024px\)[\s\S]*?\.gh-feed-column/.test(css) && /@media \(min-width: 1440px\)/.test(css)],
  ['custom wallpaper system is preserved', /--theme-wallpaper-opacity/.test(css) && /background-image: var\(--theme-wallpaper\)/.test(css)],
  ['mobile zoom is accessible', /maximumScale: 5/.test(layout) && /userScalable: true/.test(layout)],
  ['error copy no longer repeats the same sentence', !/We hit an unexpected problem\. We hit an unexpected problem/.test(errorPage)],
  ['core tabs are preserved', ['home', 'discover', 'create', 'messages', 'profile'].every((id) => appShell.includes(`id: "${id}"`))],
  ['all documented theme presets remain in the theme registry', ['gh-classic', 'emerald-night', 'violet-bloom', 'ocean-breeze', 'sunset-gold', 'midnight-ink', 'soft-sand'].every((id) => themes.includes(`"${id}"`))],
]

let failures = 0
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`)
  if (!pass) failures++
}
console.log(`\nPhase 21 premium UI checks: ${checks.length - failures}/${checks.length} passed`)
if (failures) process.exit(1)
