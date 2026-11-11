#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')
const card = read('components/ghc/daily-reward-experience.tsx')
const rewards = read('components/ghc/rewards-centre-screen.tsx')
const settings = read('components/ghc/settings.tsx')
const prompt = read('components/ghc/daily-claim-prompt.tsx')
const css = read('app/globals.css')
const checks = []
const test = (n, ok) => { checks.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`) }

test('Feed claim uses the premium responsive daily bonus card', /gh-daily-feed-card/.test(card) && /gh-daily-feed-claim/.test(card) && /GREENHAVEN DAILY REWARDS/.test(card))
test('Claimed state shows next check-in and streak progress', /Your daily reward is secured/.test(card) && /next check-in opens in/i.test(card) && /gh-daily-feed-progress/.test(card))
test('Feed card clearly labels GHC preview and Pi separation', /reward preview/.test(card) && /GHC/.test(card) && /not Pi|separate from Pi/.test(card))
test('Rewards centre separates GHC daily vs PI cashback', /Two different rewards/.test(rewards) && /0\.5% of eligible Pi spend/.test(rewards))
test('ClaimReadinessCard only in settings (not feed)', /ClaimReadinessCard/.test(settings) && !/ClaimReadinessCard/.test(card))
test('DailyRewardFeedCard and Sheet still exported', /export function DailyRewardFeedCard/.test(card) && /export function DailyRewardSheet/.test(card))
test('Server claim path still used', /postDailyClaim/.test(card))
test('Rewards Centre embeds the daily reward card and opens the global secure claim dialog', /<DailyRewardFeedCard/.test(rewards) && /ghc:open-daily-claim/.test(rewards))
test('Official GHC coin is isolated above decorative layers and cannot be hidden by overlay styles', /gh-daily-official-coin/.test(prompt) && /z-index: 7/.test(css) && /visibility: visible/.test(css) && /opacity: 1/.test(css))
test('Daily rewards adapt to small screens and respect reduced-motion settings', /@media \(max-width: 360px\)/.test(css) && /prefers-reduced-motion: reduce/.test(css) && /gh-daily-premium-dialog/.test(css))

const failed = checks.filter((x) => !x).length
console.log(`\nPhase A daily claim UX: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
