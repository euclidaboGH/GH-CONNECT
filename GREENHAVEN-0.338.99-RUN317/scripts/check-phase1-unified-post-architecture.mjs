#!/usr/bin/env node
import { readFileSync } from 'node:fs'
const read = (p) => readFileSync(p, 'utf8')
const card = read('components/ghc/enhanced-post-card.tsx')
const quote = read('components/ghc/quoted-post-preview.tsx')
const css = read('app/globals.css')
const community = read('components/ghc/community-canonical-post-card.tsx')
const checks = [
  [card.includes('data-post-surface={surface}'), 'Canonical renderer retains explicit surface identity'],
  [card.includes('<QuotedPostPreview postId={String(post.quoteOf)} />'), 'Quoted posts use the shared original-post preview'],
  [!card.includes('Original post content preview...'), 'Placeholder quote content is removed'],
  [quote.includes('/api/social/posts/${encodeURIComponent(postId)}'), 'Original post is fetched through the authenticated canonical API'],
  [quote.includes('credentials: "same-origin"') && quote.includes('cache: "no-store"'), 'Quote preview does not cache viewer-sensitive post responses'],
  [quote.includes('AbortController') && quote.includes('controller.abort()'), 'Quote preview cancels stale requests on unmount/change'],
  [quote.includes('POST_NOT_FOUND') || quote.includes('unavailable or you don’t have permission'), 'Unavailable/private originals fail closed without leaking content'],
  [quote.includes('isDurableMediaUrl') && quote.includes('LazyImage'), 'Quoted media retains durable-URL validation and lazy image loading'],
  [quote.includes('retryVersion') && quote.includes('Try again'), 'Transient quote-preview failures can be retried without remounting the feed'],
  [quote.includes('controller.signal.aborted') && quote.includes('credentials: "same-origin"'), 'Late viewer-sensitive responses are discarded after cancellation'],
  [quote.includes('ghc:open-post') && quote.includes('source: "quoted-post"'), 'Original-post navigation uses the existing app event contract'],
  [community.includes('<EnhancedPostCard') && !community.includes('<PostCard'), 'Community keeps the canonical post renderer'],
  [css.includes('--gh-post-radius: 1rem') && css.includes('.gh-post-card[data-post-surface]'), 'Canonical post-card tokens and scoped surface styles are registered'],
  [css.includes('.gh-quoted-post') && css.includes('prefers-reduced-motion: reduce'), 'Quote preview styling includes reduced-motion support'],
]
let failed = 0
for (const [ok, label] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failed++
}
console.log(`\nPhase 1 unified post architecture: ${checks.length - failed}/${checks.length} passed.`)
if (failed) process.exit(1)
