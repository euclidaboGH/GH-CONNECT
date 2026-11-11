import fs from 'node:fs'
const match = fs.readFileSync('components/ghc/match-screen.tsx','utf8')
const rewards = fs.readFileSync('components/ghc/rewards-centre-screen.tsx','utf8')
const checks = [
 ['match action centre', match.includes('Your match opportunities')],
 ['results summary', match.includes('{baseAll.length}') && match.includes('{likesYouRows.length}')],
 ['find people action', match.includes('Find people')],
 ['requests action', match.includes('setShowRequestInbox(true)')],
 ['best next step', match.includes('Best next step:')],
 ['intentional connection language', match.includes('Connect with a clear intent')],
 ['opportunities label', rewards.includes('label: msg("opportunities")') && rewards.includes('id: "opportunities"')],
 ['responsible participation copy', rewards.includes('participation path')],
 ['no rewards earn tab label', !rewards.includes('label: "Earn"')],
]
let failed=0
for (const [name, ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed++ }
console.log(`Phase 9 opportunities/matching: ${checks.length-failed}/${checks.length} PASS`)
if(failed) process.exit(1)
