import fs from "node:fs"
import path from "node:path"
const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const mobile = read("lib/mobile-performance.ts")
const perf = read("lib/performance.ts")
const settings = read("components/ghc/settings.tsx")
const checks = [
  ["image helper preserves provider-signed URLs", /Preserve provider-issued URLs byte-for-byte/.test(mobile) && /return url\s*}/.test(mobile)],
  ["image helper avoids arbitrary transformation query mutation", !/searchParams\.set\("w"/.test(mobile)],
  ["infinite-scroll lock spans the complete async load", /Promise\.resolve\(\)[\s\S]*?options\.onLoadMore\(\)[\s\S]*?finally\(\(\) => \{ locked = false \}\)/.test(mobile)],
  ["infinite-scroll threshold is bounded at zero", /Math\.max\(0, options\.thresholdPx \?\? 400\)/.test(mobile)],
  ["IntersectionObserver absence falls back to visible content", /typeof IntersectionObserver === "undefined"[\s\S]*?setIsVisible\(true\)/.test(perf)],
  ["IntersectionObserver uses a prewarm margin", /rootMargin: "160px 0px"/.test(perf)],
  ["settings security and compliance panels are lazy loaded", /const ActiveSessionsPanel = lazy\(/.test(settings) && /const CompliancePostureCard = lazy\(/.test(settings)],
  ["settings account data controls are lazy loaded", /const AccountDataControls = lazy\(/.test(settings)],
  ["lazy panels have accessible loading fallbacks", /Loading active sessions|SectionFallback label="Active sessions"/.test(settings) && /SectionFallback label="Account data controls"/.test(settings)],
]
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}`)
  if (!ok) failed++
}
console.log(`Phase 10 navigation/media gate: ${checks.length - failed}/${checks.length}`)
if (failed) process.exit(1)
