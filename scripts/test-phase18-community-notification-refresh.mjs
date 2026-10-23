import fs from 'node:fs'
import path from 'node:path'
const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const checks = [
  ['community board uses durable social curation RPC', /socialSetCuration/.test(read('components/ghc/premium-community-hub.tsx'))],
  ['community upvote/downvote controls exist', /Upvote community post/.test(read('components/ghc/premium-community-hub.tsx')) && /Downvote community post/.test(read('components/ghc/premium-community-hub.tsx'))],
  ['community curation emits shared engagement refresh', /ghc:curation-updated/.test(read('components/ghc/premium-community-hub.tsx')) && /ghc:post-engagement/.test(read('components/ghc/premium-community-hub.tsx'))],
  ['community board has durable refresh event', /ghc:community-refresh/.test(read('components/ghc/premium-community-hub.tsx')) && /ghc:community-refresh/.test(read('components/ghc/communities-screen.tsx'))],
  ['community board supports search filtering', /Search community posts/.test(read('components/ghc/premium-community-hub.tsx'))],
  ['community board supports mine filter', /My posts/.test(read('components/ghc/premium-community-hub.tsx'))],
  ['community board keeps new hot top sorting', /\["new", "hot", "top"\]/.test(read('components/ghc/premium-community-hub.tsx'))],
  ['notification bell has manual refresh', /Refresh notifications/.test(read('components/ghc/notification-bell.tsx')) && /RefreshCw/.test(read('components/ghc/notification-bell.tsx'))],
  ['notification center has all/unread filter', /Notification read filter/.test(read('components/ghc/notification-bell.tsx')) && /readFilter/.test(read('components/ghc/notification-bell.tsx'))],
  ['notification buckets expose unread counts', /bucketUnreadCounts/.test(read('components/ghc/notification-bell.tsx'))],
  ['notification auto-sync remains active', /setInterval\(refresh, 12000\)/.test(read('components/ghc/notification-bell.tsx'))],
  ['notification foreground refresh remains active', /visibilitychange/.test(read('components/ghc/notification-bell.tsx')) && /window.addEventListener\("focus", onFocus\)/.test(read('components/ghc/notification-bell.tsx'))],
  ['server curation remains canonical', /api\/social\/posts.*curation/.test(read('lib/social/client.ts')) && /socialSetCuration/.test(read('lib/social/client.ts'))],
]
let pass=0
for (const [name,ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(ok) pass++ }
if (pass !== checks.length) process.exit(1)
console.log(`PASS phase 18 community + notification convergence contract: ${pass}/${checks.length}`)
