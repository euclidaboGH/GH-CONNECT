#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const card = read('components/ghc/daily-reward-experience.tsx')
const rewards = read('components/ghc/rewards-centre-screen.tsx')
const settings = read('components/ghc/settings.tsx')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

test('Feed claim control uses rounded-full pill', /rounded-full bg-gradient-to-r from-emerald-600 to-teal-700/.test(card))
test('Claimed state is compact pill not long rectangle', /GHC daily claimed/.test(card) && /rounded-full border border-emerald-200/.test(card))
test('Feed card labels GHC not Pi', /not Pi/.test(card) && /Claim \{daily\.todayGhc\} GHC/.test(card))
test('Rewards centre separates GHC daily vs PI cashback', /Two different rewards/.test(rewards) && /0\.5% of eligible Pi spend/.test(rewards))
test('ClaimReadinessCard only in settings (not feed)', /ClaimReadinessCard/.test(settings) && !/ClaimReadinessCard/.test(card))
test('DailyRewardFeedCard and Sheet still exported', /export function DailyRewardFeedCard/.test(card) && /export function DailyRewardSheet/.test(card))
test('Server claim path still used', /postDailyClaim/.test(card))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase A daily claim UX: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
