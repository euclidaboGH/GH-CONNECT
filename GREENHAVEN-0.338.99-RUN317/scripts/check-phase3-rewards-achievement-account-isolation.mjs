#!/usr/bin/env node
/** Phase 3 regression: durable achievement hydration must never cross account boundaries. */
import { readFileSync } from 'node:fs'
const screen = readFileSync('components/ghc/rewards-centre-screen.tsx', 'utf8')
const checks = [
  ['achievement rows carry an explicit owner identity', screen.includes('serverAchievementsOwnerRef = useRef<string | null>(null)')],
  ['previous owner is invalidated before a new account hydration starts', /serverAchievementsOwnerRef\.current = null[\s\S]*?setServerAchievements\(\[\]\)[\s\S]*?fetchServerAchievements\(\)/.test(screen)],
  ['rows are accepted only after a successful durable response', /if \(!r\.ok\)[\s\S]*?setServerAchievements\(rows\)[\s\S]*?serverAchievementsOwnerRef\.current = userId/.test(screen)],
  ['achievement rendering is scoped to the active account', /serverAchievementsOwnerRef\.current === userId \? serverAchievements : \[\]/.test(screen)],
  ['failed hydration cannot retain a prior account owner', /catch\(\(\) => \{[\s\S]*?serverAchievementsOwnerRef\.current = null[\s\S]*?setServerAchievements\(\[\]\)/.test(screen)],
  ['only durable achievement IDs can complete mission cards', screen.includes('durableMissionIds.has(missionCode)') && screen.includes('Server-verified achievement saved to your account.')],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 3 achievement account isolation: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
