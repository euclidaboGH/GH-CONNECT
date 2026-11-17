#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const card = read('components/ghc/enhanced-post-card.tsx')
const actions = read('components/ghc/post-action-bar.tsx')
const feed = read('components/ghc/enhanced-feed-screen.tsx')
const profile = read('components/ghc/profile-components.tsx')
const community = read('components/ghc/community-canonical-post-card.tsx')
const composer = read('components/ghc/post-composer.tsx')
const css = read('app/globals.css')
const checks = []
const add = (ok, label) => checks.push({ ok: Boolean(ok), label })

add(card.includes('<article') && card.includes('</article>') && !card.includes('role="article"'), 'Post cards use semantic article markup')
add(card.includes('data-post-surface={surface}') && /surface\?: "feed" \| "profile" \| "community"/.test(card), 'Canonical post renderer exposes a typed surface contract')
add(feed.includes('surface="feed"') && profile.includes('surface="profile"') && community.includes('surface="community"'), 'Feed, Profile and Community use the same canonical post renderer')
add(community.includes('<EnhancedPostCard') && !community.includes('<PostCard'), 'Community canonical posts do not fork the legacy post card')
add(card.includes('data-post-no-open') && card.includes('target?.closest("button, a, input, textarea, select, video, [role=button], [data-post-no-open]")'), 'Nested post actions do not trigger the card open action')
add(card.includes('focus-visible:ring-2') && card.includes('tabIndex={onOpenPost ? 0 : undefined}'), 'Openable posts remain keyboard accessible')
add(card.includes('isDurableMediaUrl') && card.includes('SafeTextWithLinks'), 'Post media and linked text retain existing safe rendering boundaries')
add(card.includes('contentExpanded') && card.includes('Read more'), 'Long post content has an explicit expansion control')
add(actions.includes('aria-label="Post actions and Community curation"') && actions.includes('aria-label="Respond to post"'), 'Post action controls have distinct accessible groups')
add(actions.includes('grid-cols-3') && actions.includes('gh-post-response-action'), 'Comment, save and share controls have a stable mobile grid')
add(actions.includes('aria-pressed={isSaved}') && actions.includes('aria-label={`Comment'), 'Save state and comment count remain exposed to assistive technology')
add(css.includes('.gh-post-card[data-post-surface]') && css.includes('.gh-post-action-secondary .gh-post-response-action'), 'Shared post surface and responsive action styles are registered')
add(css.includes('@media (prefers-reduced-motion: reduce)') && css.includes('.gh-post-card[data-post-surface] { transition: none; }'), 'Post interactions respect reduced-motion preferences')
add(composer.includes('UnifiedCompose') && composer.includes('do not add a third composer'), 'All surfaces retain the single canonical composer')

for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.label}`)
const failed = checks.filter((item) => !item.ok)
if (failed.length) {
  console.error(`\nRun #266 social post experience: ${failed.length}/${checks.length} failed`)
  process.exit(1)
}
console.log(`\nRun #266 social post experience: ${checks.length}/${checks.length} passed.`)
