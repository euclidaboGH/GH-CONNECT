#!/usr/bin/env node
/** Phase 8: preserve notification truth when one or more durable sources fail. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const bell = readFileSync('components/ghc/notification-bell.tsx', 'utf8')
const checks = [
  ['unified notification source validates successful response shape', /const unifiedOk = Boolean\(unifiedRes\?\.ok && unifiedData\.ok && Array\.isArray\(unifiedData\.notifications\)\)/.test(bell)],
  ['social notification source validates successful response shape', /const socialOk = Boolean\(socialRes\?\.ok && socialData\.ok && Array\.isArray\(socialData\.notifications\)\)/.test(bell)],
  ['economy notification source validates successful response shape', /const economyOk = Boolean\(economyRes\?\.ok && economyData\.ok && Array\.isArray\(economyData\.items\)\)/.test(bell)],
  ['announcement source participates in source health status', /const announcementsOk = Boolean\(announcementsRes\?\.ok && announcementsData\.ok && Array\.isArray\(announcementsData\.announcements\)\)/.test(bell)],
  ['complete source outage is detected explicitly', /if \(!unifiedOk && !socialOk && !economyOk && !announcementsOk\)/.test(bell)],
  ['complete outage preserves prior list and unread count by returning before replacement', /if \(!unifiedOk && !socialOk && !economyOk && !announcementsOk\) \{[\s\S]*?setStatusMsg\([\s\S]*?return\s*\}/.test(bell)],
  ['outage status tells users refresh failed instead of claiming inbox is empty', /Could not refresh notifications\. Existing alerts were kept on screen\./.test(bell)],
  ['zero unread label distinguishes a refresh failure from caught-up state', /durableOk === false \? "Could not refresh notifications" : "All caught up"/.test(bell)],
  ['refresh in-flight state is always released by finally', /finally \{[\s\S]*?refreshInFlightRef\.current = false[\s\S]*?setListLoading\(false\)/.test(bell)],
  ['notification source requests have a finite timeout', /NOTIFICATION_SOURCE_TIMEOUT_MS = 12_000/.test(bell) && /AbortController/.test(bell) && /controller\.abort\(\)/.test(bell)],
  ['local notification cache errors do not erase the visible snapshot', /A local cache failure is not proof that the inbox is empty/.test(bell) && /Existing alerts were kept on screen/.test(bell) && !/catch \{\s*setItems\(\[\]\)\s*setUnread\(0\)/.test(bell)],
  ['failed partial sources retain previously displayed rows', /durableSource: "unified"/.test(bell) && /durableSource: "social"/.test(bell) && /durableSource: "economy"/.test(bell) && /retainedWithoutFreshDuplicate/.test(bell)],
  ['partial source outage is communicated instead of implying full freshness', /Some notification sources are unavailable/.test(bell) && /Previously loaded alerts were preserved/.test(bell)],
  ['notification read-state writes use a bounded mutation helper', /async function postNotificationMutation[\s\S]*?new AbortController\(\)[\s\S]*?window\.setTimeout[\s\S]*?controller\.abort\(\)/.test(bell)],
  ['read-state mutations are non-cacheable and session-bound', /postNotificationMutation[\s\S]*?credentials: "include"[\s\S]*?cache: "no-store"/.test(bell)],
  ['mark-all-read detects unsuccessful and timed-out source writes', /const results = await Promise\.all\(\[[\s\S]*?postNotificationMutation[\s\S]*?const failed = results\.some\(\(response\) => !response \|\| !response\.ok\)/.test(bell)],
  ['failed individual durable read restores optimistic row state', /if \(failed\) \{[\s\S]*?setItems\(\(prev\) => prev\.map\(\(item\) => item\.id === n\.id \? \{ \.\.\.item, read: n\.read \} : item\)\)[\s\S]*?refresh\(\)/.test(bell)],
  ['failed announcement and economy read writes trigger reconciliation', /durableAnnouncement[\s\S]*?if \(!response\?\.ok\)[\s\S]*?refresh\(\)[\s\S]*?durableEconomy[\s\S]*?if \(!response\?\.ok\)[\s\S]*?refresh\(\)/.test(bell)],
  ['read-success event is dispatched only after a durable write succeeds', /if \(failed\)[\s\S]*?return[\s\S]*?setStatusMsg\(null\)[\s\S]*?dispatchEvent\(new CustomEvent\("ghc:notifications-read"\)\)/.test(bell)],
]
let failed = 0
for (const [label, pass] of checks) { console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`); if (!pass) failed++ }
console.log(`\nPhase 8 notification resilience: ${checks.length - failed}/${checks.length} passed`)
assert.equal(failed, 0, 'Notification resilience checks failed')
