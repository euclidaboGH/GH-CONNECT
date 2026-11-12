import fs from 'node:fs'
const read = (file) => fs.readFileSync(file, 'utf8')
const shell = read('lib/i18n/shell.ts')
const app = read('components/ghc/app.tsx')
const settings = read('components/ghc/settings.tsx')
const regional = read('contexts/regional-context.tsx')
const checks = [
  ['all four Nigeria pilot locale packs exist', ['ha:', 'ig:', 'yo:', 'pcm:'].every((x) => shell.includes(x))],
  ['core navigation has complete five-item coverage', ['home:', 'messages:', 'communities:', 'cart:', 'profile:'].every((x) => shell.includes(x))],
  ['accessible current-tab and go-to phrases are localized', ['currentTab:', 'goTo:'].every((x) => shell.includes(x)) && app.includes('getShellMessage("currentTab"') && app.includes('getShellMessage("goTo"')],
  ['lazy-screen loading state follows the selected locale', app.includes('const loadingLabel = getShellMessage("loading"') && app.includes('label={`${loadingLabel} ${label}`}') && app.includes('<AccessibleStatus')],
  ['English remains the canonical fallback', shell.includes('const EN: ShellPack') && shell.includes('language === "en" ? EN')],
  ['unsupported locales safely fall back to English', shell.includes('return language === "ha"') && shell.includes(': "en"')],
  ['translation coverage is explicitly partial', shell.includes('"complete" | "partial" | "none"') && shell.includes('Some screens and feature details are still in English')],
  ['navigation labels and accessible names follow selected locale', app.includes('getShellMessage(id as') && app.includes('localizedLabel') && app.includes('getShellMessage("mainNavigation"')],
  ['settings discloses partial translation coverage', settings.includes('getShellTranslationStatus(regional.locale)') && settings.includes('partially translated') && settings.includes('getShellMessage("contentUnchanged"')],
  ['locale selection remains integrated with regional provider', regional.includes('setPreferredLocale') && regional.includes('document.documentElement.lang')],
]
let failures = 0
for (const [name, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`); if (!pass) failures++ }
if (failures) process.exit(1)
console.log(`Global shell translations: PASS (${checks.length}/${checks.length})`)
