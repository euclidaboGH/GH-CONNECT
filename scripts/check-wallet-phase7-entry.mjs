#!/usr/bin/env node
/** Phase 7 Wallet: read-only Pi withdrawable snapshot must be bounded and fail closed. */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
const root = join(fileURLToPath(new URL("..", import.meta.url)))
const wallet = readFileSync(join(root, "features/wallet/wallet-screen.tsx"), "utf8")
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"))
const release = readFileSync(join(root, "lib/app-release.ts"), "utf8")
const effectStart = wallet.indexOf('if (!piWithdrawOpen) return')
const effectEnd = wallet.indexOf('useEffect(() => {\n    window.addEventListener(\"ghc:open-pi-withdraw\", openPiWithdraw)', effectStart)
const effect = effectStart >= 0 && effectEnd > effectStart ? wallet.slice(effectStart, effectEnd) : ""
const openStart = wallet.indexOf("const openPiWithdraw = useCallback(() => {")
const openEnd = wallet.indexOf("}, [])", openStart)
const openHandler = openStart >= 0 && openEnd > openStart ? wallet.slice(openStart, openEnd) : ""
const checks = [
  ["Pi snapshot read is scoped to the open withdrawal sheet", effect.includes('if (!piWithdrawOpen) return')],
  ["Pi snapshot uses AbortController cancellation", effect.includes('new AbortController()') && effect.includes('controller.abort()')],
  ["Pi snapshot has a bounded eight-second timeout", effect.includes('window.setTimeout(() => controller.abort(), 8_000)')],
  ["timeout is cleared after request completion", effect.includes('finally {\n        window.clearTimeout(timeout)')],
  ["timeout is cleared during effect cleanup", effect.includes('window.clearTimeout(timeout)\n      controller.abort()')],
  ["request remains authenticated and cache-isolated", effect.includes('credentials: "include"') && effect.includes('cache: "no-store"')],
  ["request propagates abort signal", effect.includes('signal: controller.signal')],
  ["stale account/sheet values are cleared before hydration", openHandler.indexOf('setPiWithdrawAvailable(null)') >= 0 && openHandler.indexOf('setPiWithdrawUser(null)') > openHandler.indexOf('setPiWithdrawAvailable(null)') && openHandler.indexOf('setPiWithdrawOpen(true)') > openHandler.indexOf('setPiWithdrawUser(null)')],
  ["all withdrawal-sheet entry points share the snapshot-clearing opener", /addEventListener\(\"ghc:open-pi-withdraw\", openPiWithdraw\)/.test(wallet) && /openPiWithdraw\(\)/.test(wallet) && !/setPiWithdrawOpen\(true\)/.test(wallet.replace(openHandler, ""))],
  ["only explicit successful server responses are accepted", effect.includes('!res.ok || body?.ok !== true')],
  ["withdrawable values must be finite and non-negative", effect.includes('Number.isFinite(body.withdrawable)') && effect.includes('body.withdrawable >= 0') && effect.includes('Number.isFinite(body.available)') && effect.includes('body.available >= 0')],
  ["linked Pi identity is trimmed and type-checked", effect.includes('typeof body.linkedPiUsername === "string"') && effect.includes('body.linkedPiUsername.trim()')],
  ["release metadata and package lock are synchronized", Boolean(pkg.version) && lock.version === pkg.version && lock.packages?.[""]?.version === pkg.version && release.includes(`APP_RELEASE_VERSION = "${pkg.version}"`)],
  ["gate is registered exactly once in prebuild and static verification", (pkg.scripts['prebuild:checks'].match(/check-wallet-phase7-entry\.mjs/g) || []).length === 1 && (pkg.scripts["verify:static"].match(/check-wallet-phase7-entry\.mjs/g) || []).length === 1],
  ["financial mutation authorities remain outside this read-only gate", effect.includes('/api/economy/earnings/withdrawable') && !/POST|transfer|settle|payout|ledger\.insert/i.test(effect)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failed++ }
if (failed) process.exit(1)
console.log(`Wallet Phase 7 entry contract: ${checks.length}/${checks.length} checks passed.`)
