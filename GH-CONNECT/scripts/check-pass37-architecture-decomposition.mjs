#!/usr/bin/env node
import { readFileSync, statSync } from "node:fs"
import { join } from "node:path"
const read = (file) => readFileSync(join(process.cwd(), file), "utf8")
const pkg = JSON.parse(read("package.json"))
const context = read("contexts/ghc-context.tsx")
const marketplace = read("components/ghc/marketplace-screen.tsx")
const release = read("lib/app-release.ts")
const feedModule = read("lib/social/map-remote-feed-posts.ts")
const discoveryModule = read("lib/marketplace/discovery-presentation.ts")
const checks = [
  ["current release metadata agrees with package version", /^\d+\.\d+\.\d+$/.test(pkg.version) && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ["feed normalization is owned by a focused social module", feedModule.includes("export function mapRemoteFeedPosts") && !context.includes("function mapRemoteFeedPosts") && context.includes("@/lib/social/map-remote-feed-posts")],
  ["feed normalizer retains engagement normalization", feedModule.includes("normalizeEngagementMetrics") && feedModule.includes("viewerCurationChoice")],
  ["marketplace discovery helpers are extracted", discoveryModule.includes("export function relatedListingsFor") && discoveryModule.includes("export function suggestedCommunitiesFor")],
  ["marketplace screen consumes extracted presentation helpers", marketplace.includes("@/lib/marketplace/discovery-presentation") && !marketplace.includes("function relatedListingsFor")],
  ["marketplace recommendations remain sourced from real domain data", discoveryModule.includes('domain.listListings({ status: "active" })') && discoveryModule.includes("domain.listCommunities()")],
  ["financial execution boundaries are unchanged in extracted modules", !/payment|wallet|ledger|authorization|executeSpend/i.test(feedModule + discoveryModule)],
  ["no migration SQL was introduced by this architecture pass", read("docs/release-0.259.0-pass37.md").includes("No database migrations")],
]
let failures = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failures++ }
console.log(`Pass 37 architecture decomposition: ${checks.length - failures}/${checks.length}`)
if (failures) process.exit(1)
