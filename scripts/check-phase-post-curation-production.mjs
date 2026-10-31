#!/usr/bin/env node
import { readFileSync } from 'node:fs'
const post = readFileSync('components/ghc/enhanced-post-card.tsx','utf8')
const comments = readFileSync('components/ghc/comment-sheet.tsx','utf8')
const community = readFileSync('components/ghc/premium-community-hub.tsx','utf8')
const client = readFileSync('lib/social/client.ts','utf8')
const reaction = readFileSync('app/api/social/posts/[id]/reactions/route.ts','utf8')
const commentReaction = readFileSync('app/api/social/posts/[id]/comments/[commentId]/reactions/route.ts','utf8')
const curation = readFileSync('app/api/social/posts/[id]/curation/route.ts','utf8')
const checks = [
 ['PHASE 1 post actions use production-size touch targets', /h-11 min-h-11/.test(post)],
 ['PHASE 1 curation language is quality-first and does not imply minting', /Quality/.test(post) && /Voting does not create GHC/.test(post)],
 ['PHASE 1 profile reuses canonical EnhancedPostCard', /<EnhancedPostCard/.test(readFileSync('components/ghc/profile-components.tsx','utf8'))],
 ['PHASE 1 community curation uses organized action toolbar', /Community post actions/.test(community) && />Quality</.test(community)],
 ['PHASE 2 comments default to Top with Newest alternative', /useState<"top" \| "newest">\("top"\)/.test(comments) && /Top/.test(comments)],
 ['PHASE 2 Top comments rank pinned and engagement before recency', /qualityDelta/.test(comments) && /isPinned/.test(comments)],
 ['PHASE 2 reply composer retains explicit reply context', /Replying to/.test(comments) && /Cancel reply/.test(comments)],
 ['PHASE 2 comment reactions remain available', /QUICK_REACTIONS/.test(comments)],
 ['PHASE 3 social client mutations have bounded timeout', /controller\.abort\(\), 12_000/.test(client)],
 ['PHASE 3 post reaction body is bounded', /readBoundedJson\(request, 4096\)/.test(reaction)],
 ['PHASE 3 comment reaction body is bounded', /readBoundedJson\(request, 4096\)/.test(commentReaction)],
 ['PHASE 3 curation body is bounded', /readBoundedJson\(request, 8192\)/.test(curation)],
]
let pass=0
for (const [name,ok] of checks){ console.log(`${ok?'PASS':'FAIL'} ${name}`); if(ok)pass++ }
console.log(`\nPost / curation production phases: ${pass}/${checks.length} passed`)
if(pass!==checks.length) process.exit(1)
