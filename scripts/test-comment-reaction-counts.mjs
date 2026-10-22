#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'

const route = fs.readFileSync('app/api/social/posts/[id]/comments/[commentId]/reactions/route.ts', 'utf8')
const migration = fs.readFileSync('supabase/migrations/202610180012_gh_engagement_rosters.sql', 'utf8')
assert.match(migration, /jsonb_agg\(row_to_json\(q\)::jsonb\)/, 'reaction list RPC returns roster rows')
assert.match(route, /reactions\?: Array<\{ emoji\?: unknown \}>/, 'route models roster result from RPC')
assert.match(route, /data\.reactions\.reduce<Record<string, number>>/, 'route aggregates counts when RPC does not provide counts')
assert.match(route, /counts,/, 'route returns aggregate counts')
assert.doesNotMatch(route, /reactions:\s*data\.reactions/, 'route does not expose user roster to the browser')
console.log('Comment reaction count contract: 5/5 passed')
