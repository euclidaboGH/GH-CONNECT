import fs from 'node:fs'
const feed = fs.readFileSync('components/ghc/enhanced-feed-screen.tsx','utf8')
const studio = fs.readFileSync('components/ghc/creator-studio-panel.tsx','utf8')
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'))
const checks = [
 ['release version synchronized', fs.readFileSync('lib/app-release.ts','utf8').includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
 ['feed controls', feed.includes('setShowFeedControls((v) => !v)') && feed.includes('aria-expanded={showFeedControls}') && feed.includes('t("yourFeedPriorities")')],
 ['location lanes', feed.includes('["city",t("nearby")]') && feed.includes('["worldwide",t("worldwide")]') && feed.includes('setLocationLane(id)')],
 ['intent controls', feed.includes('["professional",t("professional")]') && feed.includes('["dating",t("matching")]') && feed.includes('setIntentionBias(id)')],
 ['focus mode', feed.includes('t("focusMode")') && feed.includes('setFocusMode(e.target.checked)')],
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
