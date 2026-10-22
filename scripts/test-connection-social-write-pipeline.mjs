import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const context = read('contexts/ghc-context.tsx')
const client = read('lib/social/client.ts')
const follows = read('app/api/social/follows/route.ts')
const requestRoute = read('app/api/connections/request/route.ts')
const acceptRoute = read('app/api/connections/accept/route.ts')
const declineRoute = read('app/api/connections/decline/route.ts')

const checks = [
  ['followUser declared before Feed adapter', context.indexOf('const followUser = useCallback') >= 0 && context.indexOf('const followUser = useCallback') < context.indexOf('const followFromPost = useCallback')],
  ['unfollow adapter uses explicit false target', /const unfollowFromPost = useCallback\(async \(userId: string\) => \{\s*await setFollowUser\(userId, false\)/.test(context)],
  ['follow adapter uses explicit true target', /const followFromPost = useCallback\(async \(userId: string\) => \{\s*await setFollowUser\(userId, true\)/.test(context)],
  ['follow action reads authoritative server status before toggling', /socialFetchFollowStatus\(userId\)[\s\S]{0,500}setFollowUser\(userId, !status\.isFollowing\)/.test(context)],
  ['explicit follow writes use the durable social endpoint', /socialFollow\(userId, shouldFollow\)[\s\S]{0,250}remote\.durable === false/.test(context)],
  ['client follow uses canonical authenticated endpoint', /return json\("\/api\/social\/follows",\s*\{\s*method: "POST"/.test(client)],
  ['follow endpoint authenticates actor from session', /resolveAuthenticatedUser\(request\.headers\)/.test(follows) && /p_follower_id: auth\.userId/.test(follows)],
  ['follow endpoint rejects non-durable DB fallback', /nonDurableWriteResponse\("Follow"/.test(follows)],
  ['connection request route authenticates and uses durable RPC', /resolveAuthenticatedUser\(req\.headers\)/.test(requestRoute) && /rpc\/ghc_connection_request_upsert/.test(requestRoute)],
  ['connection acceptance route uses authenticated durable flow', /resolveAuthenticatedUser/.test(acceptRoute) && /ghc_connection_request_accept/.test(acceptRoute)],
  ['connection decline route uses authenticated durable flow', /resolveAuthenticatedUser/.test(declineRoute) && /ghc_connection_request_decline/.test(declineRoute)],
]

for (const [label, ok] of checks) {
  assert.ok(ok, `FAIL: ${label}`)
  console.log(`PASS ${label}`)
}
console.log(`connection-social-write-pipeline: ${checks.length}/${checks.length} passed`)
