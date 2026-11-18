#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
const root = process.cwd()
let pass = 0, fail = 0
function ok(n, c, d="") {
  if (c) { pass++; console.log("PASS", n) }
  else { fail++; console.log("FAIL", n, d) }
}
const stories = readFileSync(join(root, "app/api/social/stories/route.ts"), "utf8")
ok("stories API accepts media facade path", /\/api\\\/media\\\/\[A-Za-z0-9_-\]\+\\\/content/.test(stories) || stories.includes("/api/media/"))
ok("safeStoryMediaUrl still requires https for absolute", stories.includes('parsed.protocol !== "https:"'))

const um = readFileSync(join(root, "lib/media/user-messages.ts"), "utf8")
ok("INVALID_MEDIA_URL humanized", um.includes("INVALID_MEDIA_URL") && um.includes("isn't ready to share"))

const storyUi = readFileSync(join(root, "components/ghc/profile-story-section.tsx"), "utf8")
ok("share blocks blob media", storyUi.includes("isBlobUrl(media.url)"))
ok("publish uses mediaUserMessage", storyUi.includes("mediaUserMessage(code"))
ok("audience chip nowrap", storyUi.includes("whitespace-nowrap"))

const disc = readFileSync(join(root, "components/ghc/discovery-grid-screen.tsx"), "utf8")
ok("discover person singular", disc.includes('"person"') && disc.includes("match suggestion"))

ok("phase 1 doc", existsSync(join(root, "docs/PHASE-1-TRUST-BREAKERS-MEDIA-2026-11-04.md")))

console.log(`\nPhase 1 trust breakers: ${pass}/${pass+fail} passed`)
process.exit(fail ? 1 : 0)
