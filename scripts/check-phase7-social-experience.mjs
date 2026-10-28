#!/usr/bin/env node
/** Phase 7 social safety/reliability contracts; source-only, no DB/provider calls. */
import fs from 'node:fs'
import path from 'node:path'
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const exists = (p) => fs.existsSync(path.join(process.cwd(), p))
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const release = read('lib/app-release.ts')
const feed = read('app/api/social/feed/route.ts')
const stories = read('app/api/social/stories/route.ts')
const bounded = read('lib/server/http/read-bounded-json.ts')
const post = read('app/api/social/posts/route.ts')
const comment = read('app/api/social/posts/[id]/comments/route.ts')
const visibility = read('lib/server/social/post-visibility.ts')
const profile = read('lib/server/identity/public-profile-hydration.ts')
const rpc = read('lib/server/social/rpc.ts')
const checks = [
  ['package and lock versions agree', pkg.version === lock.version && lock.packages?.['']?.version === pkg.version],
  ['release metadata matches package version', release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ['Phase 7 social checker is registered', pkg.scripts?.['check:phase7-social-experience'] === 'node scripts/check-phase7-social-experience.mjs'],
  ['feed requires authenticated viewer', /resolveAuthenticatedUser\(request\.headers\)/.test(feed)],
  ['feed rejects invalid page size', /INVALID_FEED_LIMIT/.test(feed) && /parsedLimit > 50/.test(feed)],
  ['feed validates stable pagination cursor', /INVALID_FEED_CURSOR/.test(feed) && /beforeIdRaw.length > 160/.test(feed)],
  ['feed uses canonical stable cursor RPC', /gh_post_list_feed_v3/.test(feed)],
  ['feed rechecks canonical post visibility', /filterVisibleSocialPosts\(auth\.userId, posts\)/.test(feed)],
  ['feed fails closed if canonical visibility is unavailable', /POST_VISIBILITY_UNAVAILABLE/.test(feed)],
  ['mute lookup returns explicit unavailable state', /Promise<Set<string> \| null>/.test(feed) && /return null/.test(feed)],
  ['feed fails closed when mute privacy state cannot be loaded', /FEED_PRIVACY_FILTER_UNAVAILABLE/.test(feed) && /if \(muted === null\)/.test(feed)],
  ['feed rejects author-less rows instead of bypassing mute privacy', /FEED_AUTHOR_ID_UNAVAILABLE/.test(feed) && /posts\.some\(\(post\) => !authorIdOf\(post\)\)/.test(feed)],
  ['feed strips muted authors before response', /posts = posts\.filter\(\(post\) => !muted\.has\(authorIdOf\(post\)\)\)/.test(feed)],
  ['story writes authenticate and rate-limit', stories.indexOf('resolveAuthenticatedUser(request.headers)') < stories.indexOf('checkRateLimit(`stories-create:')],
  ['story writes use hard bounded streaming JSON parser', /readBoundedJson\(request, 1024 \* 1024\)/.test(stories)],
  ['bounded parser enforces byte limit while streaming', /totalBytes \+= value\.byteLength/.test(bounded) && /reader\.cancel/.test(bounded)],
  ['story text length is capped', /text\.length > 2000/.test(stories)],
  ['story media rejects non-HTTPS external URLs', /parsed\.protocol !== "https:"/.test(stories)],
  ['story expiration is server-capped to 24 hours', /now \+ MAX_STORY_MS/.test(stories) && /Math\.min\(requested, now \+ MAX_STORY_MS\)/.test(stories)],
  ['public profile hydration uses narrow public field projection', /select:\s*"gh_user_id,display_name,username,photos"/.test(profile)],
  ['social upstream calls use bounded timeout', /AbortSignal\.timeout\(SOCIAL_UPSTREAM_TIMEOUT_MS\)/.test(rpc)],
  ['social post route exists for contract coverage', exists('app/api/social/posts/route.ts') && post.length > 0],
  ['comment route exists for contract coverage', exists('app/api/social/posts/[id]/comments/route.ts') && comment.length > 0],
  ['canonical visibility module exists', exists('lib/server/social/post-visibility.ts') && visibility.length > 0],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++ }
console.log(`\nPhase 7 social experience: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
