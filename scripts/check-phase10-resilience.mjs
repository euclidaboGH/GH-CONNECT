import fs from "node:fs"
import path from "node:path"
const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const sw = read("public/sw.js")
const mobile = read("lib/mobile-performance.ts")
const stories = read("lib/media/prefetch-story-media.ts")
const offline = read("components/ghc/offline-banner.tsx")
const discovery = read("components/ghc/discovery-grid-screen.tsx")
const css = read("app/globals.css")
const checks = [
  ["service worker uses a versioned public-static cache", /greenhaven-v4-public-static/.test(sw)],
  ["service worker never caches navigation documents", /request\.mode === "navigate" \|\| request\.destination === "document"\) return/.test(sw)],
  ["all API paths remain network-only", /isApiRequest\(url\.pathname\)/.test(sw) && /fetch\(request\)\.catch/.test(sw)],
  ["only explicit static paths are cache eligible", /STATIC_ASSETS\.includes\(url\.pathname\)/.test(sw) && /STATIC_PREFIXES\.some/.test(sw)],
  ["cross-origin and non-GET requests are excluded", /request\.method !== "GET" \|\| url\.origin !== self\.location\.origin/.test(sw)],
  ["authorization-bearing static requests are excluded", /request\.headers\.has\("authorization"\)/.test(sw)],
  ["private and no-store responses are not cached", /private\|no-store\|no-cache/.test(sw)],
  ["install-time precache also validates public response headers", /fetch\(asset, \{ credentials: "omit", cache: "reload" \}\)/.test(sw) && /isSafePublicStaticResponse\(response\)/.test(sw)],
  ["no cached personalized homepage fallback exists", !/cache\.addAll\(STATIC_ASSETS\).*"\/"/.test(sw) && !/caches\.match\("\/"\)/.test(sw)],
  ["feed media prefetch checks reduced-data eligibility", /if \(!shouldPrefetchNonCritical\(\)\) return/.test(mobile)],
  ["feed media prefetch rechecks eligibility at execution", /scheduleNonCriticalWork\(\(\) => \{\s*if \(!shouldPrefetchNonCritical\(\)\) return/.test(mobile)],
  ["feed media prefetch has a hard upper bound", /Math\.min\(4, limit\)/.test(mobile)],
  ["story media prefetch respects reduced-data eligibility", /shouldPrefetchNonCritical/.test(stories)],
  ["story prefetch is bounded and deferred", /Math\.min\(3, limit\)/.test(stories) && /scheduleNonCriticalWork/.test(stories)],
  ["story prefetch rechecks network state before loading", /scheduleNonCriticalWork\(\(\) => \{\s*if \(!shouldPrefetchNonCritical\(\)\) return/.test(stories)],
  ["online banner timer is cleaned up", /clearTimeout\(onlineTimer\.current\)/.test(offline)],
  ["Discovery cards defer offscreen layout and paint", /gh-discovery-card-slot/.test(discovery) && /\.gh-discovery-card-slot \{[\s\S]*?content-visibility: auto;[\s\S]*?contain-intrinsic-size: auto 280px;/.test(css)],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}`)
  if (!ok) failed++
}
console.log(`Phase 10 resilience gate: ${checks.length - failed}/${checks.length}`)
if (failed) process.exit(1)
