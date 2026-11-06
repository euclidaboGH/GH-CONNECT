#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
const root = process.cwd()
let fail = 0
const ok = (label, cond) => {
  if (cond) console.log(`PASS ${label}`)
  else {
    console.log(`FAIL ${label}`)
    fail++
  }
}
const t = fs.readFileSync(path.join(root, "components/ghc/profile-story-section.tsx"), "utf8")
ok("circular ring rail gradient unviewed", t.includes("from-pink-500 via-amber-400 to-emerald-500"))
ok("seen stories muted ring", t.includes("bg-muted-foreground/25"))
ok("own story emerald ring", t.includes("from-emerald-400 via-teal-300 to-emerald-600") && t.includes("border-emerald-500/70 bg-muted ring-2 ring-emerald-500/25"))
ok("Create CTA remains available through the single owned-story tile", t.includes("Create story") && t.includes("openCreator()"))
ok("openStory starts the first unseen story in each creator sequence", t.includes("openStory(ownStories.find((story) => !isStorySeen(story)) || ownStories[0])") && t.includes("openStory(firstUnseen || group[0])"))
ok("empty state be first", t.includes("Be first"))
ok("role listitem avatars", t.includes('role="listitem"'))
ok("progress segment animation retained", t.includes("gh-story-progress"))
ok("feed still mounts ProfileStorySection", fs.readFileSync(path.join(root, "components/ghc/enhanced-feed-screen.tsx"), "utf8").includes('scope="feed"'))
console.log("")
console.log(`Stories rail v2: ${9 - fail}/9 passed`)
process.exit(fail ? 1 : 0)
