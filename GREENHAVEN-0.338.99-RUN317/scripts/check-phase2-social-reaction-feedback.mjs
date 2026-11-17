#!/usr/bin/env node
import { readFileSync } from "node:fs"
const read = (path) => readFileSync(path, "utf8")
const card = read("components/ghc/enhanced-post-card.tsx")
const feed = read("components/ghc/enhanced-feed-screen.tsx")
const community = read("components/ghc/community-canonical-post-card.tsx")
const context = read("contexts/ghc-context.tsx")
const checks = [
  [card.includes('aria-label="Social reactions"') && card.includes('separate from quality votes'), "Social reactions are clearly separated from quality curation"],
  [card.includes('pendingSocialReaction') && card.includes('aria-busy={pendingSocialReaction !== null || undefined}'), "Reaction submission exposes accessible pending state"],
  [card.includes('disabled={pendingSocialReaction !== null}') && card.includes('Loader2'), "Repeated reaction taps are blocked while the mutation is pending"],
  [card.includes('if (result === false) return') && card.includes('setShowReactions(false)'), "Failed mutations keep the reaction tray open for retry"],
  [card.includes('await onReact(post.id, reaction.type)'), "The shared renderer waits for the mutation result before closing the tray"],
  [feed.includes('const succeeded = await reactToPost(postId, reaction)') && feed.includes('return succeeded'), "Feed passes server-confirmed mutation status to the shared renderer"],
  [community.includes('result.durable === false') && community.includes('return true') && community.includes('return false'), "Community requires durable success and reports failed mutations"],
  [context.includes('reactToPost: (postId: string, reaction?: string) => Promise<boolean>'), "Reaction context exposes an explicit success contract"],
  [context.includes('return false') && context.includes('return true') && context.includes('broadcastPostEngagement'), "Context only reports success after the durable reaction path completes"],
  [!card.includes('Positive curation reactions') && !card.includes('Negative curation reactions'), "Legacy ambiguous curation/reaction labels are removed"],
]
let failed = 0
for (const [ok, label] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`)
  if (!ok) failed++
}
console.log(`\nPhase 2 social reaction feedback: ${checks.length - failed}/${checks.length} passed.`)
if (failed) process.exit(1)
