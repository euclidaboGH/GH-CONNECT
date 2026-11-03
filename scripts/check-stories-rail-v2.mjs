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
ok("own story emerald ring", t.includes("from-emerald-500 via-teal-400 to-emerald-600"))
ok("Create CTA on feed header", t.includes(">Create<") || t.includes("Create\n"))
ok("openStory for own and others", t.includes("openStory(ownStory)") && t.includes("openStory(item)"))
ok("empty state be first", t.includes("Be first"))
ok("role listitem avatars", t.includes('role="listitem"'))
ok("progress segment animation retained", t.includes("gh-story-progress"))
ok("feed still mounts ProfileStorySection", fs.readFileSync(path.join(root, "components/ghc/enhanced-feed-screen.tsx"), "utf8").includes('scope="feed"'))
console.log("")
console.log(`Stories rail v2: ${9 - fail}/9 passed`)
process.exit(fail ? 1 : 0)
