#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs"
let failed = 0
function ok(c, m) {
  if (c) console.log(`PASS ${m}`)
  else {
    console.log(`FAIL ${m}`)
    failed++
  }
}
ok(existsSync("lib/product/essentials.ts"), "essentials lib")
ok(existsSync("components/ghc/skip-to-content.tsx"), "skip to content")
ok(existsSync("components/ghc/session-resume-toast.tsx"), "session resume")
ok(existsSync("components/ghc/global-hotkeys.tsx"), "global hotkeys")
ok(existsSync("components/ghc/safe-external-links.tsx"), "safe links")
ok(existsSync("components/ghc/media-with-retry.tsx"), "media retry")
ok(existsSync("components/ghc/pending-queue-chip.tsx"), "pending queue chip")
ok(existsSync("components/ghc/copy-id-button.tsx"), "copy id button")

const app = readFileSync("components/ghc/app.tsx", "utf8")
ok(app.includes("SkipToContent"), "app skip")
ok(app.includes("SessionResumeToast"), "app resume")
ok(app.includes("GlobalHotkeys"), "app hotkeys")

const banner = readFileSync("components/ghc/offline-banner.tsx", "utf8")
ok(banner.includes("PendingQueueChip"), "banner queue chip")

const post = readFileSync("components/ghc/enhanced-post-card.tsx", "utf8")
ok(post.includes("SafeTextWithLinks"), "post safe links")

const msg = readFileSync("components/ghc/message-components.tsx", "utf8")
ok(msg.includes("failureReason"), "message failure reason")

const disc = readFileSync("components/ghc/discovery-grid-screen.tsx", "utf8")
ok(disc.includes("onlineOnly"), "discover online filter")
ok(disc.includes("Online now"), "online chip UI")

const id = readFileSync("components/ghc/greenhaven-identity-card.tsx", "utf8")
ok(id.includes("copyTextToClipboard"), "GH ID copy fallback")

ok(existsSync("docs/ESSENTIAL_FEATURES_20_PASS12_2026-10-19.md"), "docs")

if (failed) {
  console.log(`\nESSENTIAL 20: ${failed} failure(s)`)
  process.exit(1)
}
console.log("\nESSENTIAL 20: all checks passed")
