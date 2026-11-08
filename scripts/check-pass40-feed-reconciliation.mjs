#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { join } from "node:path"
const read = (file) => readFileSync(join(process.cwd(), file), "utf8")
const pkg = JSON.parse(read("package.json"))
const lock = JSON.parse(read("package-lock.json"))
const context = read("contexts/ghc-context.tsx")
const helper = read("lib/social/reconcile-feed-posts.ts")
const release = read("lib/app-release.ts")
const truth = read("docs/PROJECT_TRUTH.md")
const manifest = read("VERIFIED_MANIFEST.txt")
const prebuild = pkg.scripts?.prebuild || ""
const checks = [
  ["package, lockfile and application release versions agree", lock.version === pkg.version && lock.packages?.[""]?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ["shared feed reconciliation helper exposes replace and append modes", helper.includes('FeedReconcileMode = "replace" | "append"') && helper.includes('mode: FeedReconcileMode = "replace"')],
  ["feed reconciliation rejects blank IDs and duplicate records", helper.includes('if (!id || post.deletedAt) continue') && helper.includes('if (!remoteById.has(id)) remoteById.set(id, post.id === id ? post : { ...post, id })')],
  ["replacement mode gives remote records precedence and preserves local continuity", helper.includes('if (mode === "append")') && helper.includes('for (const [id, post] of remoteById) merged.set(id, post)') && helper.includes('if (!remoteById.has(id)) merged.set(id, post)')],
  ["append mode adds only unseen remote records", helper.includes('if (!merged.has(id)) merged.set(id, post)')],
  ["feed ordering matches canonical SQL created_at DESC, id DESC for stable keyset cursors", helper.includes('timeDelta || String(b.id).localeCompare(String(a.id))') && read("supabase/migrations/20261022010097_gh_social_canonical_visibility.sql").includes("ORDER BY p.created_at DESC, p.id DESC")],
  ["GHC context delegates repeated feed merges to shared helper", context.includes('@/lib/social/reconcile-feed-posts') && (context.match(/reconcileFeedPosts\(/g) || []).length >= 6],
  ["GHC context no longer duplicates the previous remote/local merge pattern", !/const remoteIds = new Set\(remotePosts\.map\(\(p\) => p\.id\)\)\s*const localOnly = s\.posts\.filter/.test(context)],
  ["release truth and verified manifest match active version", truth.includes(`**Current source version:** \`${pkg.version}\``) && manifest.includes(`project_version=${pkg.version}`)],
  ["Pass 40 regression gate runs before production build", prebuild.includes("node scripts/check-pass40-feed-reconciliation.mjs") && prebuild.indexOf("node scripts/check-pass41-marketplace-resilience.mjs") < prebuild.indexOf("node scripts/check-pass40-feed-reconciliation.mjs")],
  ["helper remains free of persistence and financial execution", !/supabase|executeSpend|payment|wallet|ledger|authorization/i.test(helper)],
  ["canonical navigation contract remains intact", truth.includes("Home · Messages · Communities · Cart · Profile")],
]
let failures = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`)
  if (!ok) failures++
}
console.log(`Pass 40 feed reconciliation: ${checks.length - failures}/${checks.length}`)
if (failures) process.exit(1)
