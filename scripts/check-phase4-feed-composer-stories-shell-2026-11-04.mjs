#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
const root = process.cwd()
let pass = 0, fail = 0
function ok(n, c, d="") {
  if (c) { pass++; console.log("PASS", n) }
  else { fail++; console.log("FAIL", n, d) }
}

const feed = readFileSync(join(root, "components/ghc/enhanced-feed-screen.tsx"), "utf8")
ok("soft-refresh not only in skeleton", feed.indexOf("function FeedSkeleton()") < feed.indexOf("visibilitychange") || !feed.slice(feed.indexOf("function FeedSkeleton()"), feed.indexOf("export function EnhancedFeedScreen")).includes("visibilitychange"))
ok("live visibility soft-refresh", feed.includes("document.addEventListener(\"visibilitychange\"") && feed.includes("EnhancedFeedScreen"))
ok("feed-soft-revalidate in section refresh events", feed.includes("ghc:feed-soft-revalidate"))
ok("composer Story action wired", feed.includes("onOpenStory") && feed.includes("ghc:open-story-creator"))
ok("sticky feed toolbar", feed.includes("gh-premium-feed-toolbar sticky"))

const skel = feed.slice(feed.indexOf("function FeedSkeleton()"), feed.indexOf("export function EnhancedFeedScreen"))
ok("skeleton has no visibility listener", !skel.includes("visibilitychange"))

const bar = readFileSync(join(root, "components/ghc/composer-prompt-bar.tsx"), "utf8")
ok("composer Story button", bar.includes("onOpenStory") && bar.includes("Story"))
ok("composer premium card class", bar.includes("rounded-[1.25rem]"))

const stories = readFileSync(join(root, "components/ghc/profile-story-section.tsx"), "utf8")
ok("no dual header Create button", !stories.includes("> Create</button>") && stories.includes("hold to add"))
ok("unseen ring treatment", stories.includes("ring-emerald-500/25"))
ok("long-press add story", stories.includes("onContextMenu"))

ok("phase 4 doc", existsSync(join(root, "docs/PHASE-4-FEED-COMPOSER-STORIES-SHELL-2026-11-04.md")))

console.log(`\nPhase 4 feed/composer/stories: ${pass}/${pass+fail} passed`)
process.exit(fail ? 1 : 0)
