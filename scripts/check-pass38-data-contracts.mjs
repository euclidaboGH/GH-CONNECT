#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { join } from "node:path"
const read = (p) => readFileSync(join(process.cwd(), p), "utf8")
const pkg = JSON.parse(read("package.json"))
const feed = read("lib/social/map-remote-feed-posts.ts")
const marketplace = read("lib/marketplace/discovery-presentation.ts")
const context = read("contexts/ghc-context.tsx")
const screen = read("components/ghc/marketplace-screen.tsx")
const lock = JSON.parse(read("package-lock.json"))
const release = read("lib/app-release.ts")
const checks = [
  ["current release metadata is synchronized", lock.version === pkg.version && lock.packages?.[""]?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ["feed counts reject negative and non-finite values", feed.includes("function finiteCount") && feed.includes("Math.max(0, Math.floor(parsed))")],
  ["feed timestamps normalize seconds and ISO dates", feed.includes("function timestampMs") && feed.includes("Date.parse(value)") && feed.includes("100_000_000_000")],
  ["feed mapping remains centralized outside GHC context", context.includes("@/lib/social/map-remote-feed-posts") && !context.includes("function mapRemoteFeedPosts")],
  ["marketplace rejects negative prices", marketplace.includes("amount < 0")],
  ["marketplace listing timestamps handle seconds and future dates", marketplace.includes("normalizedTs") && marketplace.includes('"Recently listed"')],
  ["related listing work is bounded and deterministic", marketplace.includes("Math.min(12") && marketplace.includes("a.l.id.localeCompare(b.l.id)")],
  ["community recommendations are bounded", marketplace.includes("Math.min(10") && marketplace.includes("a.id.localeCompare(b.id)")],
  ["marketplace screen uses extracted helpers", screen.includes("@/lib/marketplace/discovery-presentation")],
  ["financial and persistence execution stay outside presentation helpers", !/payment|wallet|ledger|authorization|executeSpend|supabase/i.test(feed + marketplace)],
  ["canonical five-item navigation remains documented", read("docs/PROJECT_TRUTH.md").includes("Home · Messages · Communities · Cart · Profile")],
  ["release documentation records migration preservation", read("docs/release-0.260.0-pass38.md").includes("170") && read("docs/release-0.260.0-pass38.md").includes("No Supabase migration SQL")],
]
let failures = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failures++ }
console.log(`Pass 38 data-contract hardening: ${checks.length - failures}/${checks.length}`)
if (failures) process.exit(1)
