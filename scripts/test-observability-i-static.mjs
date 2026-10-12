/**
 * Section I — observability / performance / a11y static gates.
 */
import { readFileSync, existsSync } from "fs"
import { join } from "path"

const root = process.cwd()
const fails = []
const read = (rel) => {
  const p = join(root, rel)
  if (!existsSync(p)) { fails.push(`missing ${rel}`); return "" }
  return readFileSync(p, "utf8")
}

const ux = read("lib/domains/ghc-wallet-ux.ts")
for (const code of ["STEP_UP_REQUIRED", "RATE_LIMITED", "ALREADY_CLAIMED_TODAY", "mapGhcUxError"]) {
  if (!ux.includes(code)) fails.push(`ghc-wallet-ux missing ${code}`)
}

if (!existsSync(join(root, "lib/ux/map-api-error.ts"))) fails.push("map-api-error required")
const api = read("lib/ux/map-api-error.ts")
if (!api.includes("formatApiErrorToast")) fails.push("formatApiErrorToast required")
if (/supabase|service.?role|stack/i.test(api) && api.includes("return raw")) fails.push("must not leak raw stacks")

const css = read("app/globals.css")
if (!css.includes("prefers-reduced-motion")) fails.push("reduced-motion CSS required")

if (!existsSync(join(root, "hooks/use-focus-trap.ts"))) fails.push("useFocusTrap required")
const poll = read("components/ghc/poll-composer.tsx")
if (!poll.includes("useFocusTrap")) fails.push("poll composer should use focus trap")

const wallet = read("features/wallet/wallet-balance.tsx")
if (!wallet.includes("min-h-[2.85rem]") && !wallet.includes("min-h-")) {
  fails.push("wallet balance should reserve height to reduce CLS")
}

const sk = read("components/ghc/skeleton-loaders.tsx")
if (!sk.includes("FeedSkeleton") || !sk.includes("WalletActivitySkeleton")) {
  fails.push("feed/wallet skeletons required")
}

// aria-live patterns exist on key surfaces
const match = read("components/ghc/match-screen.tsx")
if (!match.includes("aria-live")) fails.push("match screen aria-live recommended")

if (fails.length) {
  console.error("test-observability-i-static FAILED")
  fails.forEach((f) => console.error(" -", f))
  process.exit(1)
}
console.log("test-observability-i-static: PASS")
