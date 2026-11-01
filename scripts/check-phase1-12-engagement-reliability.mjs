#!/usr/bin/env node
/** Regression gates for notification, initial-feed, daily-claim and curation interaction fixes. */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
const root = join(fileURLToPath(new URL("..", import.meta.url)))
const read = (p) => readFileSync(join(root, p), "utf8")
const bell = read("components/ghc/notification-bell.tsx")
const feed = read("components/ghc/enhanced-feed-screen.tsx")
const card = read("components/ghc/enhanced-post-card.tsx")
const prompt = read("components/ghc/daily-claim-prompt.tsx")
const reward = read("components/ghc/daily-reward-experience.tsx")
const checks = [
  ["notification badge is not computed by summing overlapping count-only endpoints", !/setUnread\(localUnread \+ unifiedUnread \+ socialUnread \+ economyUnread \+ announcementUnread\)/.test(bell) && !bell.includes("?countOnly=1")],
  ["notification badge uses unique visible durable IDs", /const durableById = new Map<string, Notification>\(\)/.test(bell) && /setUnread\(durableUnread \+ localUnreadOnly\)/.test(bell)],
  ["notification refresh requests are queued when a prior refresh is in flight", /refreshQueuedRef\.current = true/.test(bell) && /window\.setTimeout\(\(\) => refresh\(\), 0\)/.test(bell)],
  ["single read waits for both social and unified writes before refresh notification", /void Promise\.all\(\[[\s\S]*?\/api\/social\/notifications[\s\S]*?\/api\/notifications[\s\S]*?ghc:notifications-read/.test(bell)],
  ["mark-all read reports partial durable-store failures", /const results = await Promise\.all/.test(bell) && /Some alerts could not be marked read/.test(bell)],
  ["feed performs initial canonical server hydration on mount", /Always hydrate the canonical server feed on first mount/.test(feed) && /const result = await refreshFeed\(\)/.test(feed)],
  ["feed initial hydration retries a superseded response", /result\.error === "FEED_REQUEST_SUPERSEDED"/.test(feed) && /result = await refreshFeed\(\)/.test(feed)],
  ["feed waits for initial network hydration before rendering an empty state", /!feedBootstrapped \|\| !initialFeedLoadSettled/.test(feed)],
  ["feed rehydrates when profile identity becomes available or changes", /\[refreshFeed, profile\?\.id\]/.test(feed)],
  ["floating daily claim has a synchronous duplicate-submit guard", /claimInFlightRef = useRef\(false\)/.test(prompt) && /claimInFlightRef\.current = true/.test(prompt)],
  ["daily feed card and reward sheet both guard duplicate claim submissions", (reward.match(/claimInFlightRef = useRef\(false\)/g) || []).length === 2 && (reward.match(/claimInFlightRef\.current = true/g) || []).length === 2],
  ["upvote tap submits an authoritative upvote directly", /onClick=\{\(e\) => \{[\s\S]*?void handleCuration\("upvote"\)/.test(card)],
  ["downvote tap submits an authoritative downvote directly", /onClick=\{\(e\) => \{[\s\S]*?void handleCuration\("downvote"\)/.test(card)],
  ["vote clicks do not open the reaction picker or bubble into post navigation", /setShowReactions\(false\)[\s\S]*?void handleCuration\("upvote"\)/.test(card) && /e\.stopPropagation\(\)/.test(card) && !/setCurationReactionKind\("positive"\)[\s\S]{0,100}setShowReactions\(\(visible\) => !visible\)/.test(card)],
  ["long press still opens voter roster without submitting an accidental vote", /startCurationRosterLongPress\("upvotes"\)/.test(card) && /startCurationRosterLongPress\("downvotes"\)/.test(card) && /curationRosterLongPressRef\.current/.test(card)],
  ["vote counts and selection reset from canonical props between post cards", /setUpvoteCount\(typeof propUp === "number"[\s\S]*?setDownvoteCount\(typeof propDown === "number"[\s\S]*?setCurationChoice\(propViewerChoice/.test(card)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failed++ }
console.log(`\nEngagement reliability regression contract: ${checks.length - failed}/${checks.length} passed`)
process.exit(failed ? 1 : 0)
