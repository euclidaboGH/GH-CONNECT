import fs from 'node:fs'
const card = fs.readFileSync('components/ghc/enhanced-post-card.tsx', 'utf8')
const helper = fs.readFileSync('lib/active-upgrades/community.ts', 'utf8')
const checks = [
  ['post upvote and downvote seeds use safe integer normalization', /const seedUp = safeCommunityCount\(/.test(card) && /const seedDown = safeCommunityCount\(/.test(card)],
  ['post count prop refreshes reject fractional, negative and unsafe values', /setUpvoteCount\(safeCommunityCount\(propUp\)\)/.test(card) && /setDownvoteCount\(safeCommunityCount\(propDown\)\)/.test(card)],
  ['server reaction aggregate values are normalized before state updates', /safeCommunityCount\(res\.upvoteCount\)/.test(card) && /safeCommunityCount\(res\.downvoteCount\)/.test(card)],
  ['sentiment ratio uses a bounded safe aggregate', /safeCommunityCountTotal\(\[upvoteCount, downvoteCount\]\)/.test(card)],
  ['shared safe count helper rejects non-integers and negative values', /Number\.isSafeInteger\(count\) && count >= 0/.test(helper)],
  ['shared aggregate helper caps total at MAX_SAFE_INTEGER', /Math\.min\(Number\.MAX_SAFE_INTEGER/.test(helper)],
]
let failed=0
for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${label}`);if(!ok)failed++}
console.log(`Phase 3 post engagement count hardening: ${checks.length-failed}/${checks.length}`)
if(failed)process.exit(1)
