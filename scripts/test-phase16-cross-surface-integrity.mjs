import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const checks = [
  ['post GET includes quote reference', /quote_of_post_id/.test(read('app/api/social/posts/[id]/route.ts'))],
  ['post GET hydrates durable content reward', /getPublicContentReward/.test(read('app/api/social/posts/[id]/route.ts')) && /contentReward/.test(read('app/api/social/posts/[id]/route.ts'))],
  ['post client exposes hydrated reward', /contentReward\?/.test(read('lib/social/client.ts'))],
  ['notification deep link carries comment id', /commentId:/.test(read('lib/notification-center.ts'))],
  ['notification deep link dispatches comment target', /ghc:open-post/.test(read('lib/notification-center.ts')) && /commentId: link\.commentId/.test(read('lib/notification-center.ts'))],
  ['feed accepts focused comment routing', /ghc:focus-comment/.test(read('components/ghc/enhanced-feed-screen.tsx'))],
  ['comment sheet consumes focused comment routing', /ghc:focus-comment/.test(read('components/ghc/comment-sheet.tsx')) && /data-comment-id/.test(read('components/ghc/comment-sheet.tsx'))],
  ['comment API remains visibility-gated', /canViewSocialPost/.test(read('app/api/social/posts/[id]/comments/route.ts'))],
  ['stable comment pagination remains active', /gh_comment_list_v3/.test(read('app/api/social/posts/[id]/comments/route.ts'))],
  ['creator endpoint exposes reputation', /getReputationState/.test(read('app/api/social/creator/route.ts'))],
  ['post lifecycle edit remains durable', /socialEditPost/.test(read('lib/social/client.ts'))],
  ['quote repost remains durable', /createQuoteRepost/.test(read('contexts/ghc-context.tsx'))],
  ['archive/restore remain server-backed', /gh_set_post_archived|gh_post_restore/.test(read('supabase/migrations/20261022010056_gh_post_archive_quote.sql')) && /gh_post_restore/.test(read('supabase/migrations/20261022010109_gh_post_restore_owner_window.sql'))],
]
let pass=0
for (const [name, ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(ok) pass++ }
if(pass!==checks.length) process.exit(1)
console.log(`PASS phase 16 cross-surface integrity contract: ${pass}/${checks.length}`)
