#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
const root = process.cwd()
let fail = 0
const ok = (l, c) => { if (c) console.log(`PASS ${l}`); else { console.log(`FAIL ${l}`); fail++ } }
const post = fs.readFileSync(path.join(root, "components/ghc/enhanced-post-card.tsx"), "utf8")
ok("quality group aria", post.includes('aria-label="Quality votes"'))
ok("respond group aria", post.includes('aria-label="Respond"'))
ok("flex quality/respond layout", post.includes("justify-between") && post.includes("Quality votes"))
const rewards = fs.readFileSync(path.join(root, "components/ghc/rewards-centre-screen.tsx"), "utf8")
ok("rewards useSectionRefresh", rewards.includes('useSectionRefresh("rewards"'))
ok("package and app release are synchronized", fs.readFileSync(path.join(root, "lib/app-release.ts"), "utf8").includes(`APP_RELEASE_VERSION = "${JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version}"`))
console.log(`\nMaintenance 0.287: ${5 - fail}/5 passed`)
process.exit(fail ? 1 : 0)
