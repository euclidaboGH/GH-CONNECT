#!/usr/bin/env node
/** Regression contract for canonical server-authoritative voting and roster gestures. */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
const root = join(fileURLToPath(new URL("..", import.meta.url)))
const card = readFileSync(join(root, "components/ghc/enhanced-post-card.tsx"), "utf8")
const actionBar = readFileSync(join(root, "components/ghc/post-action-bar.tsx"), "utf8")
const checks = [
  ["post card delegates the selected vote to the canonical curation handler", /onVote=\{\(c\) => \{[\s\S]*?setShowReactions\(false\)[\s\S]*?void handleCuration\(c\)/.test(card)],
  ["upvote and downvote controls are rendered by the shared action bar", /voteBtn\("upvote"\)/.test(actionBar) && /voteBtn\("downvote"\)/.test(actionBar)],
  ["vote interaction prevents parent-card activation", /e\.preventDefault\(\)/.test(actionBar) && /e\.stopPropagation\(\)/.test(actionBar)],
  ["votes are disabled while the server mutation is pending", /disabled=\{busy\}/.test(actionBar) && /if \(busy\) return/.test(actionBar)],
  ["voter roster long press and pointer cancellation are wired", /onPointerDown: \(e\) => \{ if \(e\.button === 0\) startCurationRosterLongPress\(kind\) \}/.test(card) && /onPointerCancel: \(\) => endCurationRosterLongPress\(true\)/.test(card) && /onPointerLeave: \(\) => endCurationRosterLongPress\(true\)/.test(card)],
  ["voter roster uses the 650ms deliberate gesture", /}, 650\)/.test(card) && /openRoster\(kind\)/.test(card)],
  ["vote buttons retain accessible labels and pressed state", /aria-label=\{active \? `Change vote to \${c}`/.test(actionBar) && /aria-pressed=\{active\}/.test(actionBar)],
  ["vote controls retain 44px touch targets and visible focus rings", /min-h-11 min-w-\[3\.25rem\]/.test(actionBar) && /focus-visible:ring-2/.test(actionBar)],
  ["GHC movement is only handled from server response", /res\.redistribute\?\.credited/.test(card) && /res\.reward\?\.credited/.test(card)],
  ["vote state is rehydrated from canonical post props", /setUpvoteCount\(typeof propUp === "number"[\s\S]*?setDownvoteCount\(typeof propDown === "number"[\s\S]*?setCurationChoice\(propViewerChoice/.test(card)],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failed++ }
console.log(`\n${checks.length - failed}/${checks.length} deliberate-voting checks passed`)
if (failed) process.exit(1)
