#!/usr/bin/env node
import fs from "node:fs"
const helper = fs.readFileSync("lib/social/reconcile-feed-posts.ts", "utf8")
const sql = fs.readFileSync("supabase/migrations/20261022010097_gh_social_canonical_visibility.sql", "utf8")
const screen = fs.readFileSync("components/ghc/enhanced-feed-screen.tsx", "utf8")
const provider = fs.readFileSync("contexts/ghc-context.tsx", "utf8")
const route = fs.readFileSync("app/api/social/feed/route.ts", "utf8")
const checks = [
  ["client reconciliation uses canonical created_at DESC, id DESC tie ordering", helper.includes("timeDelta || String(b.id).localeCompare(String(a.id))")],
  ["database keyset query uses matching created_at DESC, id DESC order", sql.includes("ORDER BY p.created_at DESC, p.id DESC") && sql.includes("p.id < p_before_id")],
  ["feed pagination consumes the canonical server-issued cursor", screen.includes("refreshFeed({ append: true, limit: 20 })") && provider.includes("feedCursorRef.current = nextCursor") && provider.includes("before: requestedCursor?.before")],
  ["public context contract exposes the server cursor to Feed", (provider.match(/nextCursor\?: \{ before: number; beforeId: string \} \| null/g) || []).length >= 3],
  ["append requests fail closed when no server cursor exists", provider.includes('opts?.append && !requestedCursor') && provider.includes('"FEED_CURSOR_UNAVAILABLE"')],
  ["replacement refresh resets the cursor across viewer/session changes", provider.includes('if (!opts?.append)') && provider.includes('feedCursorRef.current = null')],
  ["append requests reject a non-advancing server cursor", provider.includes('"FEED_CURSOR_DID_NOT_ADVANCE"')],
  ["server only advertises another page when the requested page is full", route.includes("rawPagePosts.length === limit && last?.id")],
  ["feed helper documents cursor-order parity", helper.includes("This tie-break must match SQL because the last row becomes the next cursor")],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failed++ }
console.log(`Feed keyset ordering contract: ${checks.length - failed}/${checks.length}`)
if (failed) process.exit(1)
