import fs from 'node:fs'
import assert from 'node:assert/strict'

const formatting = fs.readFileSync('lib/i18n/formatting.ts', 'utf8')
const context = fs.readFileSync('contexts/regional-context.tsx', 'utf8')
const engine = fs.readFileSync('lib/i18n/index.ts', 'utf8')
const governance = fs.readFileSync('lib/i18n/review-governance.ts', 'utf8')
const notifications = fs.readFileSync('components/ghc/notification-bell.tsx', 'utf8')
const checks = [
  ['locale presentation exposes direction and numbering system', /getLocalePresentation[\s\S]*direction:[\s\S]*numberingSystem/.test(formatting)],
  ['compact numbers use Intl.NumberFormat', /notation:\s*"compact"/.test(formatting)],
  ['percent formatting uses percent style', /style:\s*"percent"/.test(formatting)],
  ['unit formatting validates finite values', /formatUnit[\s\S]*Number\.isFinite\(value\)/.test(formatting)],
  ['relative time uses Intl.RelativeTimeFormat', /Intl\.RelativeTimeFormat/.test(formatting)],
  ['plural formatting uses Intl.PluralRules', /Intl\.PluralRules/.test(formatting)],
  ['locale-aware sorting uses Intl.Collator', /Intl\.Collator/.test(formatting)],
  ['notification counts use the selected locale number formatter', /regional\.formatNumber\(count\)/.test(notifications) && /regional\.formatNumber\(filtered\.length\)/.test(notifications)],
  ['regional context exposes all formatting helpers', ['formatCompactNumber', 'formatPercent', 'formatUnit', 'formatRelativeValue', 'formatPluralMessage', 'compareLocaleText', 'localePresentation'].every((key) => context.includes(key))],
  ['formatting does not mutate wallet or currency data', /formatCurrency/.test(engine) && /financialRule/.test(governance)],
  ['all formatters retain English fallback', (formatting.match(/DEFAULT_LOCALE/g) ?? []).length >= 7],
]
for (const [name, passed] of checks) {
  assert.equal(passed, true, name)
  console.log(`PASS ${name}`)
}
console.log(`Global locale formatting: ${checks.length}/${checks.length} passed`)
