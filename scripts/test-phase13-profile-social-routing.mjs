import fs from 'node:fs'
import assert from 'node:assert/strict'

const app = fs.readFileSync('components/ghc/app.tsx', 'utf8')
const feed = fs.readFileSync('components/ghc/enhanced-feed-screen.tsx', 'utf8')
const profile = fs.readFileSync('components/ghc/profile-screen.tsx', 'utf8')
const composer = fs.readFileSync('components/ghc/unified-compose.tsx', 'utf8')
const client = fs.readFileSync('lib/social/client.ts', 'utf8')
const postRoute = fs.readFileSync('app/api/social/posts/[id]/route.ts', 'utf8')

assert.match(profile, /ghc:open-create-hub/, 'Profile must open the canonical create hub')
assert.match(app, /ghc:open-compose/, 'App shell must own cross-screen composer events')
assert.match(app, /showGlobalComposer/, 'Global composer state must live at app-shell level')
assert.match(app, /<PostComposer[\s\S]*open=\{showGlobalComposer\}/, 'Global PostComposer must be mounted by the app shell')
assert.match(feed, /ghc:open-post-ready/, 'Feed must accept delayed post-routing events after tab navigation')
assert.match(feed, /socialGetPost\(postId\)/, 'Feed must hydrate posts missing from the current feed page')
assert.match(feed, /routedPost/, 'Feed must retain a routed post for comment/detail overlays')
assert.match(client, /export async function socialGetPost/, 'Durable single-post client API must exist')
assert.match(postRoute, /export async function GET/, 'Single-post durable GET route must exist')
assert.match(postRoute, /canViewSocialPost\(auth\.userId, postId\)/, 'Single-post route must enforce server visibility')
assert.match(composer, /createPost\(/, 'Unified composer must still use canonical createPost')
assert.doesNotMatch(feed, /<PostComposer/, 'Feed must not own a second composer instance')

console.log('PASS phase 13 profile/social routing contract: 11/11')
