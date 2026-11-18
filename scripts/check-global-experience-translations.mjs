import fs from 'node:fs'
const read = (file) => fs.readFileSync(file, 'utf8')
const catalog = read('lib/i18n/experience.ts')
const feed = read('components/ghc/enhanced-feed-screen.tsx')
const discover = read('components/ghc/discovery-grid-screen.tsx')
const home = read('components/ghc/home-command-centre.tsx')
const checks = [
  ['typed experience catalog covers feed, discovery and home', ['forYou','feedPersonalization','searchPosts','professionals','discoveryOutcome','homeMorning'].every((key) => catalog.includes(`"${key}"`))],
  ['Hausa, Igbo, Yoruba and Pidgin preview packs exist', ['ha: {','ig: {','yo: {','pcm: {'].every((key) => catalog.includes(key))],
  ['English fallback is preserved for missing pack keys', catalog.includes('PACKS[language][key] ?? EN[key]')],
  ['feed filters and feed search use locale-aware messages', feed.includes('getExperienceMessage') && feed.includes('t(filter.label)') && feed.includes('t("searchPosts")')],
  ['feed preference controls use locale-aware labels', feed.includes('t("locationRelevance")') && feed.includes('t("focusModeHelp")')],
  ['feed offline and draft states use locale-aware labels', feed.includes('t("offlineFeed")') && feed.includes('t("draftsOnDevice")')],
  ['discovery categories and search use locale-aware messages', discover.includes('t(cat.label)') && discover.includes('t("searchPeople")')],
  ['discovery accessibility and offline states use locale-aware messages', discover.includes('t("connectionFilters")') && discover.includes('t("offlineDiscovery")')],
  ['home greeting responds to selected locale', home.includes('timeGreeting(new Date(), regional.locale)') && home.includes('getExperienceMessage')],
  ['catalog explicitly requires native-speaker review', catalog.includes('Native-speaker review is required')],
  ['user content and financial/identity flows are excluded from translation scope', catalog.includes('never translate user-authored content') && catalog.includes('wallet balances, payment states')],
  ['translation coverage remains explicitly partial', catalog.includes('getExperienceTranslationStatus') && catalog.includes('"partial"')],
]
let failures = 0
for (const [name, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`); if (!pass) failures++ }
if (failures) process.exit(1)
console.log(`Global experience translations: PASS (${checks.length}/${checks.length})`)
