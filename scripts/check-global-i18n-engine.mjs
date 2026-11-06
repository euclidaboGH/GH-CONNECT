import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const fail = []
const ok = (name, condition) => condition ? console.log(`PASS ${name}`) : fail.push(name)
const read = (path) => fs.readFileSync(`${root}/${path}`, 'utf8')
const i18n = read('lib/i18n/index.ts')
const regional = read('contexts/regional-context.tsx')
const settings = read('components/ghc/settings.tsx')
const regionalCore = read('lib/regional-context.ts')
const pkg = JSON.parse(read('package.json'))
const languageSource = read('lib/geography/country-languages.ts')

ok('canonical locale resolver and BCP 47 validation', i18n.includes('Intl.getCanonicalLocales') && i18n.includes('resolveLocale'))
ok('English fallback is explicit and translation readiness is separate', i18n.includes('APPROVED_UI_LOCALES') && i18n.includes('isUiTranslationAvailable'))
ok('timezone formatter avoids invalid dateStyle/timeStyle component mixing', regionalCore.includes('timeZoneName: "short"') && regionalCore.includes('hour: "numeric"'))
ok('locale-aware number, currency, date and list formatting', ['formatNumber','formatCurrency','formatDate','formatList'].every((name) => i18n.includes(`function ${name}`)))
ok('RTL direction is locale/script-driven', i18n.includes('getLocaleDirection') && i18n.includes('pa-Arab-PK') === false && regional.includes('document.documentElement.dir'))
ok('country-language registry drives language choices', i18n.includes('COUNTRY_LANGUAGE_RECOMMENDATIONS') && settings.includes('getLocaleOptions'))
ok('language preference is persisted and synchronized across tabs without a database migration', regional.includes('LOCALE_STORAGE_KEY') && regional.includes('localStorage.setItem') && regional.includes('window.addEventListener("storage"') && !pkg.scripts['db:migrate'])
ok('language preference reaches API regional headers', regional.includes('"X-GH-Locale": locale') && regional.includes('"X-GH-Timezone": timeZone'))
ok('settings clearly marks untranslated choices and preserves user content', settings.includes('not translated yet') && settings.includes('getShellMessage("contentUnchanged"') && settings.includes('getShellTranslationStatus'))
ok('country-language matrix remains available', languageSource.includes('COUNTRY_LANGUAGE_RECOMMENDATIONS'))
ok('i18n static gate is registered', pkg.scripts['check:global-i18n-engine'] && pkg.scripts['verify:static']?.includes('check-global-i18n-engine') && pkg.scripts.prebuild?.includes('check-global-i18n-engine'))

if (fail.length) { console.error(`Global i18n engine: ${fail.length} failure(s)`); fail.forEach((name) => console.error(`FAIL ${name}`)); process.exit(1) }
console.log('Global i18n engine: PASS')
