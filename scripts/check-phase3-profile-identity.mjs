import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const checks = [
  ['canonical public profile hydration helper exists', fs.existsSync(path.join(root, 'lib/server/identity/public-profile-hydration.ts'))],
  ['helper reads only public identity columns', /select:\s*"gh_user_id,display_name,username,photos"/.test(read('lib/server/identity/public-profile-hydration.ts'))],
  ['helper never reads balances or membership fields', !/select:\s*"[^"]*(balance|membership|entitlement|wallet)/i.test(read('lib/server/identity/public-profile-hydration.ts'))],
  ['feed rehydrates canonical authors', /hydratePublicProfileIdentity\(rawPosts/.test(read('app/api/social/posts/route.ts'))],
  ['post detail rehydrates canonical author', /hydratePublicProfileIdentity\(\[post/.test(read('app/api/social/posts/[id]/route.ts'))],
  ['comments rehydrate canonical authors', /hydratePublicProfileIdentity\(hydratedComments/.test(read('app/api/social/posts/[id]/comments/route.ts'))],
  ['profile timeline rehydrates canonical authors', /hydratePublicProfileIdentity\(visiblePosts/.test(read('app/api/social/profile/[userId]/posts/route.ts'))],
  ['stories rehydrate canonical owners', /hydratePublicProfileIdentity\(enrichedStories/.test(read('app/api/social/stories/route.ts'))],
  ['identity helper uses no-store fetch', /cache:\s*"no-store"/.test(read('lib/server/identity/public-profile-hydration.ts'))],
  ['release version is 0.93.0 or newer phase release', /^0\.9[3-9]\.\d+$/.test(JSON.parse(read('package.json')).version)],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed++
}
console.log(`Phase 3 profile identity checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
