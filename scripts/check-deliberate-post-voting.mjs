#!/usr/bin/env node
/** Regression contract: accidental post taps must not submit curation or debit GHC. */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
const root = join(fileURLToPath(new URL("..", import.meta.url)))
const card = readFileSync(join(root, "components/ghc/enhanced-post-card.tsx"), "utf8")
const checks = [
  ["normal upvote tap submits a server-authoritative vote", /void handleCuration\("upvote"\)/.test(card) && /aria-label=\{curationChoice === "upvote" \? "Change vote to upvote" : "Upvote this post"\}/.test(card)],
  ["normal downvote tap submits a server-authoritative vote", /void handleCuration\("downvote"\)/.test(card) && /aria-label=\{curationChoice === "downvote" \? "Change vote to downvote" : "Downvote this post"\}/.test(card)],
  ["vote taps stop propagation and close the reaction overlay", /e\.stopPropagation\(\)/.test(card) && /setShowReactions\(false\)[\s\S]{0,100}void handleCuration\("upvote"\)/.test(card) && /setShowReactions\(false\)[\s\S]{0,100}void handleCuration\("downvote"\)/.test(card)],
  ["a 650ms long press opens the voter roster rather than delaying the vote", /}, 650\)/.test(card) && /openRoster\(kind\)/.test(card) && !/}, 1200\)/.test(card)],
  ["pointer cancellation clears a pending roster gesture", /onPointerCancel=\{\(\) => endCurationRosterLongPress\(true\)\}/.test(card) && /onPointerLeave=\{\(\) => endCurationRosterLongPress\(true\)\}/.test(card)],
  ["post media no longer opens reaction picker by long press", !/onTouchStart=\{\(\) => handleLongPress/.test(card) && !/onMouseDown=\{\(\) => handleLongPress/.test(card)],
  ["reaction icons use compact sizing", /h-8 min-w-8[\s\S]{0,100}text-base/.test(card)],
  ["GHC movement is only handled from server response", /res\.redistribute\?\.credited/.test(card) && /res\.reward\?\.credited/.test(card)],
  ["vote state is rehydrated from canonical post props", /setUpvoteCount\(typeof propUp === "number"[\s\S]*?setDownvoteCount\(typeof propDown === "number"[\s\S]*?setCurationChoice\(propViewerChoice/.test(card)],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failed++ }
console.log(`\n${checks.length - failed}/${checks.length} deliberate-voting checks passed`)
if (failed) process.exit(1)
