#!/usr/bin/env node
import fs from "node:fs"
import assert from "node:assert/strict"

const read = (path) => fs.readFileSync(path, "utf8")
const composer = read("components/ghc/composer-prompt-bar.tsx")
const interstitial = read("components/ghc/feed-interstitial.tsx")
const feed = read("components/ghc/enhanced-feed-screen.tsx")
const pkg = JSON.parse(read("package.json"))
const lock = JSON.parse(read("package-lock.json"))
const checks = [
  ["composer remains a single entry to the canonical create flow", composer.includes("openRef.current") && composer.includes("onClick={onOpen}")],
  ["composer uses a restrained neutral surface without decorative gradient treatment", composer.includes("rounded-[1.25rem] border border-border/70 bg-card") && !composer.includes("bg-gradient-to-br")],
  ["composer exposes a single clear text entry action", composer.includes("{placeholder}") && composer.includes('aria-label="Create a post"')],
  ["quick media actions are limited to photo and video", composer.includes("Photo") && composer.includes("Video") && !composer.includes("Feeling") && !composer.includes("Smile")],
  ["photo and video actions preserve their dedicated handlers", composer.includes("onOpenPhoto || onOpen") && composer.includes("onOpenVideo || onOpen")],
  ["discovery interstitials are reduced to one per twelve posts", interstitial.includes("indexAfterPost % 12 !== 0") && !interstitial.includes("% 8 !== 0")],
  ["discovery prompts cycle without manufacturing people or listings", interstitial.includes('["people", "communities", "marketplace", "create"]') && interstitial.includes("Hide when empty; never invent users or listings")],
  ["interstitials are suppressed in focus mode and non-personalized feeds", feed.includes('!focusMode && activeFilter === "for-you" && interstitialKindAt(index)')],
  ["feed and profile reuse the same composer component", feed.includes("<ComposerPromptBar")],
  ["release and lockfile metadata are synchronized", pkg.version === lock.version && lock.version === pkg.version && lock.packages?.[""]?.version === pkg.version && read("lib/app-release.ts").includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ["phase 15 gate is registered in prebuild and static verification", pkg.scripts['prebuild:checks'].includes("check-feed-experience-phase15") && pkg.scripts["verify:static"].includes("check-feed-experience-phase15")],
  ["no alternate publisher or new persistence authority was introduced", !composer.includes("createPost(") && !composer.includes("localStorage")],
]
for (const [name, passed] of checks) { assert.equal(passed, true, name); console.log(`PASS ${name}`) }
console.log(`Feed experience Phase 15: ${checks.length}/${checks.length} passed`)
