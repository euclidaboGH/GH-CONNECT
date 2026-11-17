#!/usr/bin/env node
import { readFileSync } from 'node:fs'
const s=readFileSync('components/ghc/global-search.tsx','utf8')
const checks=[
 ['creators are a first-class tab', s.includes('tabBtn("creators", "Creators")')],
 ['videos are a first-class tab', s.includes('tabBtn("videos", "Videos")')],
 ['durable people results do not fall back on empty server result', s.includes('if (serverOk) {') && !s.includes('if (serverOk && serverPeople.length > 0)')],
 ['durable posts are rendered', s.includes('return serverPosts')],
 ['durable creator results are rendered', s.includes('creatorHits.map')],
 ['durable video results are rendered', s.includes('videoHits.map')],
 ['services remain connected to marketplace', s.includes('openListing(String(h.id))')],
 ['search retains request cancellation', s.includes('new AbortController()') && s.includes('ac.abort()')],
 ['no-result UI is structurally separated from event results', s.includes('No results for “{debouncedQuery}”</p>') && s.indexOf('No results for “{debouncedQuery}”</p>') < s.indexOf('{(showEvents || showActivities || showServices) && (')],
]
let pass=0
for(const [name,ok] of checks){ console.log(`${ok?'PASS':'FAIL'} ${name}`); if(ok) pass++ }
console.log(`Massive Search Upgrade: ${pass}/${checks.length} passed`)
if(pass!==checks.length) process.exit(1)
