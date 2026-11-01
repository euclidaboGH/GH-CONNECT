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
  ['identity upstream request has a finite timeout', /signal:\s*AbortSignal\.timeout\(5000\)/.test(read('lib/server/identity/public-profile-hydration.ts'))],
  ['public photos reject protocol-relative and control-character URLs', /url\.startsWith\("\/\/"\)/.test(read('lib/server/identity/public-profile-hydration.ts')) && /\\u0000-\\u001f/.test(read('lib/server/identity/public-profile-hydration.ts'))],
  ['profile upstream JSON is streamed with a hard 1 MiB bound', /readBoundedProfileRows\(response, 1024 \* 1024\)/.test(read('lib/server/identity/public-profile-hydration.ts')) && /total > maxBytes/.test(read('lib/server/identity/public-profile-hydration.ts'))],
  ['profile rows are restricted to requested canonical identities', /requestedIds\.has\(id\)/.test(read('lib/server/identity/public-profile-hydration.ts')) && /data\.length > ids\.length/.test(read('lib/server/identity/public-profile-hydration.ts'))],
  ['nested comment/reply trees are hydrated with explicit row and depth bounds', /NESTED_PUBLIC_ROWS/.test(read('lib/server/identity/public-profile-hydration.ts')) && /MAX_NESTED_ROWS = 500/.test(read('lib/server/identity/public-profile-hydration.ts')) && /MAX_NESTED_DEPTH = 12/.test(read('lib/server/identity/public-profile-hydration.ts'))],
  ['legacy avatar fallbacks are sanitized with the public URL policy', /publicPhoto\(firstString\(item/.test(read('lib/server/identity/public-profile-hydration.ts'))],
  ['release version is at least 0.93.0', (() => { const [major, minor, patch] = JSON.parse(read('package.json')).version.split('.').map(Number); return major > 0 || minor > 93 || (minor === 93 && patch >= 0) })()],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed++
}
console.log(`Phase 3 profile identity checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
