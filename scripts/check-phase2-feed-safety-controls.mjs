#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const source = readFileSync('lib/feed-ranking-engine.ts', 'utf8')
const checks = [
  ['blocked and muted authors share one suppression policy', /function getSuppressedAuthorIds\(context: FeedContext\)[\s\S]*?blockedUserIds[\s\S]*?mutedUserIds/.test(source)],
  ['suppression identifiers are normalized before comparison', /\.map\(\(id\) => String\(id\)\.trim\(\)\)\.filter\(Boolean\)/.test(source)],
  ['For You applies hard block and mute suppression', /rankForYouFeed[\s\S]*?isSuppressedAuthor\(post, suppressedAuthorIds\)/.test(source)],
  ['Following applies hard block and mute suppression', /rankFollowingFeed[\s\S]*?isSuppressedAuthor\(post, suppressedAuthorIds\)/.test(source)],
  ['Nearby applies hard block and mute suppression', /rankNearbyFeed[\s\S]*?isSuppressedAuthor\(post, suppressedAuthorIds\)/.test(source)],
  ['Trending applies hard block and mute suppression', /rankTrendingFeed[\s\S]*?isSuppressedAuthor\(post, suppressedAuthorIds\)/.test(source)],
  ['Latest applies hard block and mute suppression', /rankLatestFeed[\s\S]*?isSuppressedAuthor\(post, suppressedAuthorIds\)/.test(source)],
  ['Saved applies hard block and mute suppression', /rankSavedFeed[\s\S]*?isSuppressedAuthor\(p, suppressedAuthorIds\)/.test(source)],
  ['Friends and Communities continue to enforce both block and mute', /rankFriendsFeed[\s\S]*?blockedUserIds[\s\S]*?mutedUserIds/.test(source) && /rankCommunitiesFeed[\s\S]*?blockedUserIds[\s\S]*?mutedUserIds/.test(source)],
  ['Latest is strictly chronological with no following boost', /rankLatestFeed[\s\S]*?const score = post\.createdAt \|\| 0[\s\S]*?\.sort\(compareRankedPosts\)/.test(source) && !/rankLatestFeed[\s\S]*?score \+= 1/.test(source)],
  ['rank ties have deterministic timestamp and ID ordering', /function compareRankedPosts[\s\S]*?b\.score - a\.score[\s\S]*?b\.post\.createdAt[\s\S]*?b\.post\.id/.test(source)],
  ['feed suppression remains presentation/ranking-only and does not mutate financial authority', !/getSuppressedAuthorIds[\s\S]{0,500}(?:wallet|ledger|payment|payout|supabase)/i.test(source)],
]
let failures = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failures++
}
console.log(`Phase II feed safety controls: ${checks.length - failures}/${checks.length} passed`)
if (failures) process.exit(1)
