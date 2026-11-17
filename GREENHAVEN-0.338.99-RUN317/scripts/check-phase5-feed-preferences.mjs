#!/usr/bin/env node
import fs from "node:fs"
import assert from "node:assert/strict"
const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const migration = read("supabase/migrations/20261114100001_gh_feed_preferences_durable.sql")
const store = read("lib/server/feed/preferences-store.ts")
const route = read("app/api/social/feed/preferences/route.ts")
const feedRoute = read("app/api/social/feed/route.ts")
const screen = read("components/ghc/enhanced-feed-screen.tsx")
const checks = [
  ["durable feed preference table is account-keyed", /gh_feed_preferences\s*\(\s*user_id text PRIMARY KEY/.test(migration)],
  ["preference table enables RLS and denies browser roles", /ENABLE ROW LEVEL SECURITY/.test(migration) && /USING \(false\) WITH CHECK \(false\)/.test(migration) && /REVOKE ALL ON TABLE public\.gh_feed_preferences FROM PUBLIC, anon, authenticated/.test(migration)],
  ["read and write RPCs are service-role-only", /REVOKE ALL ON FUNCTION public\.gh_feed_preferences_get\(text\) FROM PUBLIC, anon, authenticated/.test(migration) && /REVOKE ALL ON FUNCTION public\.gh_feed_preferences_set\(text, jsonb\) FROM PUBLIC, anon, authenticated/.test(migration) && /GRANT EXECUTE ON FUNCTION public\.gh_feed_preferences_set\(text, jsonb\) TO service_role/.test(migration)],
  ["database enforces bounded preference collections", /hiddenPostIds'\) <= 200/.test(migration) && /notInterestedPostIds'\) <= 200/.test(migration) && /mutedTopics'\) <= 100/.test(migration)],
  ["store reads and writes only through canonical RPCs", store.includes('socialRpc("gh_feed_preferences_get"') && store.includes('socialRpc("gh_feed_preferences_set"')],
  ["API derives user identity from authenticated session", route.includes("resolveAuthenticatedUser(request.headers)") && route.includes("auth.userId") && !route.includes("body.userId")],
  ["API rate limits and bounds writes", route.includes("checkDurableRateLimit") && route.includes("readBoundedJson(request, 24 * 1024)")],
  ["API validates allowlisted feed modes and Unicode topic IDs", route.includes("filters = new Set") && /\\p\{L\}/.test(route) && /\\p\{M\}/.test(route)],
  ["feed route applies durable hidden and not-interested exclusions", feedRoute.includes("durablePreferences.hiddenPostIds") && feedRoute.includes("durablePreferences.notInterestedPostIds")],
  ["feed route enforces muted topics without changing raw cursor progression", feedRoute.includes("durablePreferences.mutedTopics") && /last raw server row/.test(feedRoute)],
  ["client imports existing local controls once and syncs account-scoped state", screen.includes("data.exists === true") && screen.includes("/api/social/feed/preferences") && screen.includes("IdentityService.getCurrentUserId() !== ownerAtStart")],
  ["feed UI accurately reports account sync status", screen.includes("Synced across devices") && screen.includes("Saved on this device only")],
  ["feed does not render cached account data until server preference hydration settles", /serverPreferencesLoadedFor === feedPreferenceOwnerId/.test(screen)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failed++ }
console.log(`Phase 5 durable preference contract: ${checks.length - failed}/${checks.length}`)
assert.equal(failed, 0, "Phase 5 durable preference contract failed")
