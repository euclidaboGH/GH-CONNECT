#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const disc = read('lib/community/discovery.ts')
const hub = read('components/ghc/premium-community-hub.tsx')
const screen = read('components/ghc/communities-screen.tsx')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

test('Discovery helper exists', existsSync(join(root, 'lib/community/discovery.ts')))
test('Privacy filter helpers', /matchesPrivacyFilter/.test(disc) && /privacyFilterLabel/.test(disc))
test('Hub has dedicated mod tab', /\| "mod"/.test(hub) && /Moderation console/.test(hub))
test('Mod tab only for moderators in tab list', /t\.id !== "mod"/.test(hub))
test('Moderation console opens from About CTA', /setTab\("mod"\)/.test(hub) && /Open moderation console/.test(hub))
test('Join queue in mod console', /Join queue/.test(hub) && /pendingJoinRequests/.test(hub))
test('Communities screen privacy filter chips', /privacyFilter/.test(screen) && /Access filter/.test(screen))
test('visibleGroups applies privacy filter', /matchesPrivacyFilter\(c\.privacy, privacyFilter\)/.test(screen))
test('Board/Updates/Members hub tabs remain', /announcements/.test(hub) && /members/.test(hub) && /board/.test(hub))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase D communities product: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
