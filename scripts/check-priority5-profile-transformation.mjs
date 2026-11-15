#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const app = read('components/ghc/app.tsx')
const profile = read('components/ghc/profile-screen.tsx')
const tabs = read('components/ghc/profile-section-tabs.tsx')
const preview = read('components/ghc/profile-preview-page.tsx')
const privacy = read('app/api/social/profile/[userId]/route.ts')
const release = read('lib/app-release.ts')
const pkg = JSON.parse(read('package.json'))
const checks = [
  ['release metadata matches the current package version', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['peer profiles retain privacy-projected professional identity', /professional\s*,/.test(app) && /business\s*,/.test(app) && /profileMode: row\.profileMode/.test(app)],
  ['public profile hydration retains portfolio skills and mode', /skills: Array\.isArray\(row\.skills\)/.test(app) && /professional,/.test(app) && /business,/.test(app)],
  ['cached discovery profiles are enriched instead of bypassing canonical projection', /if \(local\) setPeerProfile\(local\)/.test(app) && /socialGetProfile\(userId\)/.test(app)],
  ['stale public-profile responses are fenced and privacy denials fail closed', /publicProfileRequestRef/.test(app) && /requestId !== publicProfileRequestRef\.current/.test(app) && /canonical public projection is the privacy authority/.test(app) && /setPeerProfile\(null\)/.test(app)],
  ['share action creates a profile-specific deep link', /\?profile=\$\{encodeURIComponent\(meId\)\}/.test(profile)],
  ['application resolves profile deep links through canonical profile event', /searchParams\.get\("profile"\)/.test(app) && /ghc:open-profile/.test(app)],
  ['owner About presents professional/business portfolio and achievements', /id="gh-profile-about"/.test(profile) && /<ProfileProfessionalShowcase/.test(profile) && /<ProfileAchievementShowcase/.test(profile)],
  ['social metrics do not display fabricated zeroes while authoritative counts load', /timelinePosts === null \? "—"/.test(profile) && /authoritativeFollowCounts\?\.followers \?\? "—"/.test(profile)],
  ['authoritative identity snapshot supplies follow counts', /<ProfileIdentityOverview onCounts=\{setAuthoritativeFollowCounts\}/.test(profile)],
  ['profile tabs expose ARIA panel relationships and keyboard navigation', /aria-controls=\{`gh-profile-panel-\$\{tab\.id\}`\}/.test(tabs) && /id=\{`gh-profile-tab-\$\{tab\.id\}`\}/.test(tabs) && /ArrowRight/.test(tabs) && /ArrowLeft/.test(tabs) && /role=\"tabpanel\"/.test(profile)],
  ['peer preview consumes professional showcase in read-only mode', /<ProfileProfessionalShowcase profile=\{candidate\} readOnly/.test(preview)],
  ['public profile API uses privacy projection and strips private economy', /projectPublicProfile\(full/.test(privacy) && /delete \(profile as Record<string, unknown>\)\.wallet/.test(privacy) && /delete \(profile as Record<string, unknown>\)\.membership/.test(privacy)],
]
let passed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (ok) passed++
}
console.log(`Priority 5 Profile transformation: ${passed}/${checks.length}`)
if (passed !== checks.length) process.exit(1)
