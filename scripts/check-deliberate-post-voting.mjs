#!/usr/bin/env node
/** Regression contract: accidental post taps must not submit curation or debit GHC. */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
const root = join(fileURLToPath(new URL("..", import.meta.url)))
const card = readFileSync(join(root, "components/ghc/enhanced-post-card.tsx"), "utf8")
const checks = [
  ["normal upvote tap opens reaction picker instead of voting", /setCurationReactionKind\("positive"\)[\s\S]{0,120}setShowReactions\(\(visible\) => !visible\)/.test(card) && !/onClick=\{\(e\) => \{[\s\S]{0,250}void handleCuration\("upvote"\)/.test(card)],
  ["normal downvote tap opens reaction picker instead of voting", /setCurationReactionKind\("negative"\)[\s\S]{0,120}setShowReactions\(\(visible\) => !visible\)/.test(card) && !/onClick=\{\(e\) => \{[\s\S]{0,250}void handleCuration\("downvote"\)/.test(card)],
  ["curation action requires a 1.2 second hold", /setTimeout\(\(\) => \{[\s\S]{0,180}void handleCuration\(choice\)[\s\S]{0,60}\}, 1200\)/.test(card)],
  ["pointer cancellation cancels pending vote", /onPointerCancel=\{\(\) => endCurationLongPress\(true\)\}/.test(card) && /onPointerLeave=\{\(\) => endCurationLongPress\(true\)\}/.test(card)],
  ["post media no longer opens reaction picker by long press", !/onTouchStart=\{\(\) => handleLongPress/.test(card) && !/onMouseDown=\{\(\) => handleLongPress/.test(card)],
  ["reaction icons use compact sizing", /h-8 min-w-8[\s\S]{0,100}text-base/.test(card)],
  ["GHC movement is only handled from server response", /res\.redistribute\?\.credited/.test(card) && /res\.reward\?\.credited/.test(card)],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failed++ }
console.log(`\n${checks.length - failed}/${checks.length} deliberate-voting checks passed`)
if (failed) process.exit(1)
