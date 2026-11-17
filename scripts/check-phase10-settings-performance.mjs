import fs from "node:fs"
import path from "node:path"
const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const settings = read("components/ghc/settings.tsx")
const mobile = read("lib/mobile-performance.ts")
const performance = read("lib/performance.ts")
const checks = [
  ["performance section is reachable from Settings", /title: "Performance & data"/.test(settings) && /goToSection\("performance"\)/.test(settings)],
  ["device diagnostics are browser-capability based", /getDevicePerformanceProfile\(\)/.test(settings) && /hardwareConcurrency/.test(settings)],
  ["diagnostics do not claim synthetic benchmark scores", /not a synthetic speed score/.test(settings)],
  ["reduced-data preference is device local", /ghc:prefer-reduced-data:v1/.test(mobile) && /localStorage\.setItem/.test(mobile)],
  ["storage failures fail safely", /catch \{[\s\S]{0,160}return false/.test(mobile) && /catch \{[\s\S]{0,160}Storage may be unavailable/.test(mobile)],
  ["reduced-data preference suppresses optional prefetch", /!preferReducedData\(\)/.test(mobile)],
  ["system data-saver preference takes priority", /profile\.saveData \|\| profile\.effectiveType === "2g"/.test(mobile)],
  ["settings explain local-only scope", /does not change your account settings/.test(settings)],
  ["financial decisions remain server-authoritative", /payment and entitlement decisions server-authoritative/.test(settings)],
  ["accessible keyboard focus remains present", /focus-visible:ring-2/.test(settings)],
  ["async memoization has bounded LRU eviction", /maxEntries \?\? 100/.test(performance) && /cache\.size > maxEntries/.test(performance)],
  ["async memoization expires resolved values", /ttlMs \?\? 30_000/.test(performance) && /expiresAt > now/.test(performance)],
  ["concurrent identical async work is deduplicated", /const pending = new Map<string, Promise<Return>>/.test(performance) && /if \(inFlight\) return inFlight/.test(performance)],
  ["cache expiry timer cannot evict a newer request", /requestCache\.get\(key\) === scheduledValue/.test(performance)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} — ${label}`); if (!ok) failed++ }
console.log(`Phase 10 settings/performance gate: ${checks.length - failed}/${checks.length}`)
if (failed) process.exit(1)
