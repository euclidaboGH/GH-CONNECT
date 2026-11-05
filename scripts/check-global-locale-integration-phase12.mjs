#!/usr/bin/env node
import fs from 'node:fs'
import assert from 'node:assert/strict'

const read = (path) => fs.readFileSync(path, 'utf8')
const context = read('contexts/regional-context.tsx')
const formatting = read('lib/i18n/formatting.ts')
const governance = read('lib/i18n/review-governance.ts')
const shell = read('lib/i18n/shell.ts')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['explicit locale preference is retained in memory when browser storage is blocked', context.includes('explicitLocaleRef = useRef<string | null | undefined>(undefined)') && context.includes('explicitLocaleRef.current !== undefined') && context.includes('savedLocale || getClientLocale()')],
  ['stored locale is promoted into the in-session preference before later refreshes', /explicitLocaleRef\.current === undefined && savedLocale[\s\S]*explicitLocaleRef\.current = resolveLocale\(savedLocale\)/.test(context)],
  ['manual locale selection updates state before best-effort persistence', /explicitLocaleRef\.current = next[\s\S]*setPreferredLocaleState\(next\)[\s\S]*setLocale\(next\)[\s\S]*localStorage\.setItem/.test(context)],
  ['cross-tab locale changes update the active preference', context.includes('window.addEventListener("storage", onStorage)') && context.includes('explicitLocaleRef.current = event.newValue ? next : null')],
  ['reset pins browser-language fallback for the session even if storage removal fails', /explicitLocaleRef\.current = null[\s\S]*localStorage\.removeItem/.test(context) && context.includes('explicitLocaleRef.current !== undefined')],
  ['document language and writing direction follow the active locale', context.includes('document.documentElement.lang = locale') && context.includes('document.documentElement.dir = getLocaleDirection(locale)')],
  ['regional API headers carry locale and timezone metadata', context.includes('"X-GH-Locale": locale') && context.includes('"X-GH-Timezone": timeZone')],
  ['locale presentation remains separate from stored financial values', governance.includes('Never localise or recalculate amounts, currency codes, payment status, fees, wallet balances, or transaction identifiers')],
  ['user-generated content remains untranslated by policy', governance.includes('Never translate user-generated posts, private messages, profile text, listing descriptions, or community content automatically')],
  ['partial Nigerian language packs remain explicitly partial', ['ha', 'ig', 'yo', 'pcm'].every((locale) => shell.includes(`${locale}: {`)) && shell.includes('return rawLanguage === "ha" || rawLanguage === "ig" || rawLanguage === "yo" || rawLanguage === "pcm" ? "partial" : "none"')],
  ['unit formatting fails safely when runtime locale or unit data is unsupported', formatting.includes('catch {\n    try { return new Intl.NumberFormat(DEFAULT_LOCALE, formatOptions).format(value) }') && formatting.includes('String(unit)')],
  ['plural count formatting has an independent English fallback', formatting.includes('let formattedCount = String(count)') && formatting.includes('formattedCount = new Intl.NumberFormat(DEFAULT_LOCALE).format(count)')],
  ['release metadata is synchronized', pkg.version === JSON.parse(read('package-lock.json')).version && read('lib/app-release.ts').includes(`APP_RELEASE_VERSION = "${pkg.version}"`) && JSON.parse(read('package-lock.json')).version === pkg.version && JSON.parse(read('package-lock.json')).packages[''].version === pkg.version],
  ['integration gate is registered in prebuild and static verification', pkg.scripts['check:global-locale-integration-phase12'] && pkg.scripts.prebuild.includes('check-global-locale-integration-phase12') && pkg.scripts['verify:static'].includes('check-global-locale-integration-phase12')],
]
for (const [name, passed] of checks) { assert.equal(passed, true, name); console.log(`PASS ${name}`) }
console.log(`Global locale integration Phase 12: ${checks.length}/${checks.length} passed`)
