import fs from 'node:fs'
const feed = fs.readFileSync('components/ghc/enhanced-feed-screen.tsx','utf8')
const studio = fs.readFileSync('components/ghc/creator-studio-panel.tsx','utf8')
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'))
const checks = [
 ['version 0.226.0', pkg.version === '0.226.0'],
 ['feed controls', feed.includes('Your feed, your priorities')],
 ['location lanes', feed.includes('Nearby') && feed.includes('Worldwide')],
 ['intent controls', feed.includes('Professional') && feed.includes('Matching')],
 ['focus mode', feed.includes('Focus mode') && feed.includes('setFocusMode')],
 ['preferences persist', feed.includes('ghc.feedLocationLane') && feed.includes('ghc.feedIntentionBias')],
 ['creator engagement rate', studio.includes('Engagement rate') && studio.includes('engagementRate')],
 ['creator meaningful actions', studio.includes('Meaningful actions') && studio.includes('engagementTotal')],
 ['creator next action', studio.includes('Next best action') && studio.includes('nextBestAction')],
 ['no earnings prediction', studio.includes('does not predict rewards or earnings')],
]
let failed=0
for (const [name,ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed++ }
console.log(`\n${checks.length-failed}/${checks.length} PASS`)
process.exitCode=failed?1:0
