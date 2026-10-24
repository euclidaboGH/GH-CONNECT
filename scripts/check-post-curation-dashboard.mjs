import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const panel = readFileSync(new URL('../components/ghc/post-reward/post-reward-panel.tsx', import.meta.url), 'utf8')
const card = readFileSync(new URL('../components/ghc/enhanced-post-card.tsx', import.meta.url), 'utf8')
const types = readFileSync(new URL('../lib/content-reward/public-types.ts', import.meta.url), 'utf8')
const checks = [
  ['expandable dashboard', panel.includes('aria-expanded={expanded}') && panel.includes('setExpanded((value) => !value)')],
  ['view count connected from post engagement', card.includes('views={post.engagement?.views ?? 0}')],
  ['zero-state engagement statistics', panel.includes('Total views') && panel.includes('Upvotes') && panel.includes('Downvotes') && panel.includes('Net votes')],
  ['author and curation reward breakdown', panel.includes('Author rewards') && panel.includes('Curation rewards')],
  ['upvote, downvote and net impact', panel.includes('Upvote impact') && panel.includes('Downvote impact') && panel.includes('Net impact')],
  ['reward status labels accruing/finalized/settled', panel.includes('ACCRUING') && panel.includes('FINALIZED') && panel.includes('SETTLED')],
  ['inactive state avoids fabricated zero rewards', panel.includes('Not yet accruing') && panel.includes('No reward amount is reported')],
  ['server-authoritative reward and insights APIs retained', panel.includes('`${base}/reward`') && panel.includes('`${base}/insights`') && types.includes('totalEarned: number | null')],
  ['server-confirmed view and qualified-view aggregates', panel.includes('serverViews') && panel.includes('qualifiedViews') && panel.includes('Server-confirmed reach')],
  ['manual refresh and event-driven refresh', panel.includes('Refresh curation insights') && panel.includes('ghc:post-engagement') && panel.includes('ghc:content-reward-updated')],
  ['durable curation vote broadcasts analytics refresh', card.includes('source: "curation-vote"') && card.includes('ghc:content-reward-updated')],
  ['safe narrow-screen responsive layout', panel.includes('grid-cols-2') && panel.includes('sm:grid-cols-4')],
]
for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`)
  assert.ok(passed, label)
}
console.log(`Post curation dashboard: ${checks.length}/${checks.length} passed.`)
