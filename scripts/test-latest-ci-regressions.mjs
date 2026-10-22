import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const visibility = readFileSync('lib/server/social/post-visibility.ts', 'utf8')
const signedUrl = readFileSync('app/api/media/[id]/signed-url/route.ts', 'utf8')
const ghcContext = readFileSync('contexts/ghc-context.tsx', 'utf8')

assert.match(visibility, /type PostRow\s*=\s*\{[^}]*archived_at:\s*string\s*\|\s*null/s,
  'PostRow must model archived_at because canonical visibility queries select it')
assert.match(visibility, /select:\s*"id,author_id,visibility,community_id,deleted_at,archived_at"/,
  'canonical post visibility must continue selecting archived_at')
assert.match(signedUrl, /typeof storagePath !== "string"/,
  'signed URL route must runtime-validate storagePath after RPC/fallback assignment')
assert.match(signedUrl, /typeof ownerId !== "string"/,
  'signed URL route must runtime-validate ownerId')
assert.match(signedUrl, /typeof bucketName !== "string"/,
  'signed URL route must runtime-validate bucket')
assert.match(signedUrl, /storagePath\.startsWith\(`\$\{ownerId\}\/`\)/,
  'signed URL route must bind storage object path to the validated owner')
assert.match(signedUrl, /storagePath\.split\("\/"\)\.some\(\(part\) => !part \|\| part === "\."\)/,
  'signed URL route must reject empty and dot path segments')
assert.match(signedUrl, /storagePath\.split\("\/"\)\.map\(\(part\) => encodeURIComponent\(part\)\)/,
  'signed URL route must encode each validated path segment')

assert.match(ghcContext, /const canMessageUser = useCallback\([\s\S]*?\}, \[state\.settings\?\.blockedUsers, state\.blockedUsers\]\)/,
  'canMessageUser must be memoized with the block-state dependencies it reads')
assert.match(ghcContext, /const unfollowFromPost = useCallback\(async \(userId: string\) => \{\s*await setFollowUser\(userId, false\)\s*\}, \[setFollowUser\]\)/,
  'unfollowFromPost must use an explicit durable unfollow target and stable dependency')
assert.ok(ghcContext.indexOf('const followUser = useCallback') >= 0 && ghcContext.indexOf('const followUser = useCallback') < ghcContext.indexOf('const followFromPost = useCallback'),
  'followUser must be declared before any callback that references it')
assert.match(ghcContext, /const followFromPost = useCallback\(async \(userId: string\) => \{\s*await setFollowUser\(userId, true\)\s*\}, \[setFollowUser\]\)/,
  'followFromPost must use the explicit durable follow operation, not a later-declared toggle callback')
assert.doesNotMatch(ghcContext, /const followFromPost = useCallback\([\s\S]{0,180}?await followUser\(userId\)[\s\S]{0,100}?\}, \[followUser\]\)/,
  'followFromPost must not capture followUser before its declaration')
assert.match(ghcContext, /const applyShareResult = useCallback\([\s\S]*?\}, \[sendMessage, addToast\]\)/,
  'applyShareResult must be memoized with its sendMessage and toast dependencies')
assert.match(ghcContext, /const mutedIdsForUi = useMemo\([\s\S]*?\}, \[state\]\)/,
  'muted ID memo must not duplicate a nested state dependency')
assert.match(ghcContext, /const swipe = useCallback\([\s\S]*?\}, \[state, domains, addToast\]\)/,
  'swipe callback must declare the state snapshot it reads')
assert.match(ghcContext, /const startConversation = useCallback\([\s\S]*?\}, \[state\.conversations, domains, addToast, canMessageUser\]\)/,
  'startConversation must not depend on the unused whoCanMessage property')
assert.doesNotMatch(ghcContext, /\[state\.profile\.displayName, state\.conversations, addToast\]/,
  'device-local messaging callbacks must not depend on conversations when they only use functional updates')
assert.doesNotMatch(ghcContext, /\[state\.friends, state\.friendRequests, state\.profile, domains, addToast\]/,
  'addFriend must not depend on friendRequests when updates use functional state setters')

console.log('Latest CI regression checks: 19/19 passed')
