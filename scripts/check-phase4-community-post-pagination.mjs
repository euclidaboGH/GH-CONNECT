#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = (path) => readFileSync(path, 'utf8')
const route = read('app/api/communities/[id]/posts/route.ts')
const client = read('lib/social/client.ts')
const hub = read('components/ghc/premium-community-hub.tsx')
const migration = read('supabase/migrations/20261106110001_phase1_curation_community_guard_reconciliation.sql')
const checks = [
  ['database cursor is deterministic on createdAt and id', /ORDER BY \(extract\(epoch FROM p\.created_at\) \* 1000\)::bigint DESC, p\.id DESC/.test(migration) && /p\.id < p_before_id/.test(migration)],
  ['database pagination continues to enforce active community membership', migration.includes('gh_community_platform_role(v_community_id, v_viewer_id) IS NULL')],
  ['API bounds page size to leave room for look-ahead row', /parsed >= 1 && parsed <= 99/.test(route) && /const queryLimit = limit \+ 1/.test(route)],
  ['API derives next cursor from final returned row only when another row exists', /const hasMore = rows\.length > limit/.test(route) && /rows\.slice\(0, limit\)/.test(route) && /nextCursor/.test(route)],
  ['API validates cursor id and timestamp before returning it', /Number\.isSafeInteger\(before\)/.test(route) && /\^\[a-zA-Z0-9_\-\]\{1,180\}\$/.test(route)],
  ['API keeps community response private and non-cacheable', route.includes('Cache-Control') && route.includes('no-store, private') && route.includes('Vary: "Cookie, Authorization"')],
  ['client forwards cursor and exposes validated next cursor', /query\.set\("before", String\(cursor\.before\)\)/.test(client) && /nextCursor: cursor/.test(client)],
  ['hub requests subsequent page using server cursor', /socialListCommunityPosts\(community\.id, 60, cursor\)/.test(hub)],
  ['hub deduplicates page merges by canonical post id', /new Map\(current\.map\(\(post\) => \[String\(post\.id \|\| ""\), post\]\)\)/.test(hub)],
  ['hub fences stale page responses and prevents concurrent load-more requests', /requestId !== canonicalBoardRequestRef\.current/.test(hub) && /if \(!cursor \|\| canonicalBoardLoadingMore\) return/.test(hub)],
  ['hub exposes accessible loading and load-more state', /Load more community discussions/.test(hub) && /Loading discussions…/.test(hub)],
  ['hub resets pagination on community change and refresh', /setCanonicalBoardNextCursor\(null\)/.test(hub) && /canonicalBoardCommunityRef\.current !== community\.id/.test(hub)],
]
let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
  if (!ok) failed++
}
console.log(`Phase 4 community pagination: ${checks.length - failed}/${checks.length} checks passed`)
assert.equal(failed, 0)
