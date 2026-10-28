#!/usr/bin/env node
/** Network/DB-independent regression contract for visible loading and recovery UX. */
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const read = (p) => readFileSync(join(root, p), "utf8")
const pkg = JSON.parse(read("package.json"))
const lock = JSON.parse(read("package-lock.json"))
const feed = read("components/ghc/enhanced-feed-screen.tsx")
const media = read("components/ghc/media-with-retry.tsx")
const checks = [
  ["release versions are synchronized", /^\d+\.\d+\.\d+$/.test(pkg.version) && lock.version === pkg.version && lock.packages?.[""].version === pkg.version && read("lib/app-release.ts").includes(`APP_RELEASE_VERSION = "${pkg.version}"`) && read("VERIFIED_MANIFEST.txt").includes(`project_version=${pkg.version}`)],
  ["feed distinguishes failed loading from a legitimate empty feed", /displayPosts\.length === 0 && feedError/.test(feed) && /Your feed couldn't load/.test(feed) && /not an empty feed/.test(feed)],
  ["feed error has a retry action and prevents retry while offline", /onClick=\{\(\) => void handleRefresh\(\)\}/.test(feed) && /disabled=\{isRefreshing \|\| isOffline\}/.test(feed)],
  ["existing feed content remains rendered when a refresh error occurs", /\{feedError \? <div/.test(feed) && /\) : displayPosts\.length === 0 && feedError/.test(feed)],
  ["offline state is announced to assistive technology", /role="status"\>Offline — showing available feed data/.test(feed)],
  ["media loading remains lazy and asynchronously decoded", /loading="lazy"/.test(media) && /decoding="async"/.test(media)],
  ["missing media has an accessible labelled fallback", /aria-label=\{alt \? `\$\{alt\} — media unavailable`/.test(media)],
  ["failed media exposes an accessible retry action", /aria-label=\{alt \? `Retry loading \$\{alt\}`/.test(media) && /setNonce\(\(n\) => n \+ 1\)/.test(media)],
  ["UX regression gate is included in static verification", read("scripts/verify-phase14-static.mjs").includes('"check-phase1-12-audit-ux.mjs"')],
]
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if (!ok) failed++ }
console.log(`\nAudit UX regression checks: ${checks.length - failed}/${checks.length} passed`)
if (failed) process.exit(1)
