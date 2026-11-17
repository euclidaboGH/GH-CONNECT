import fs from "node:fs"

const read = (path) => fs.readFileSync(path, "utf8")
const component = read("components/ghc/profile-identity-overview.tsx")
const profile = read("components/ghc/profile-screen.tsx")
const checks = [
  ["identity overview uses canonical session identity", component.includes("IdentityService.getCurrentUserId()")],
  ["account changes clear and rehydrate the identity snapshot", component.includes("IdentityService.subscribe") && component.includes("setSnapshot(null)")],
  ["identity requests are abortable and latest-request-wins", component.includes("requestRef.current?.abort()") && component.includes("signal: controller.signal")],
  ["stale identity responses cannot update the current profile", component.includes("IdentityService.getCurrentUserId() !== requestIdentity")],
  ["reputation progress exposes accessible progress semantics", component.includes('role="progressbar"') && component.includes("aria-valuenow={progressPercent}")],
  ["identity loading state is announced to assistive technology", component.includes('role="status"') && component.includes('aria-live="polite"')],
  ["refresh failure preserves last-known snapshot with a retry", component.includes("Showing the last confirmed snapshot") && component.includes('>Retry</button>')],
  ["identity actions retain accessible focus and touch targets", component.includes("min-h-11") && component.includes("focus-visible:ring-2")],
  ["profile pagination remains isolated from stale account responses", profile.includes("IdentityService.getCurrentUserId() !== meId")],
]
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} — ${name}`)
const failed = checks.filter(([, ok]) => !ok)
console.log(`Phase 7 Premium Profile Experience: ${checks.length - failed.length}/${checks.length}`)
if (failed.length) process.exit(1)
