#!/usr/bin/env node
/** Regression contract for wallet actions, GH Spend UX and retry-safe utility requests. */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
const root = join(fileURLToPath(new URL("..", import.meta.url)))
const wallet = readFileSync(join(root, "features/wallet/wallet-screen.tsx"), "utf8")
const tools = readFileSync(join(root, "features/wallet/wallet-tools.tsx"), "utf8")
const utility = readFileSync(join(root, "components/ghc/ghc-utility-panel.tsx"), "utf8")
const route = readFileSync(join(root, "app/api/economy/utility/route.ts"), "utf8")
const catalog = readFileSync(join(root, "app/api/economy/catalog/route.ts"), "utf8")
const checks = [
  ["wallet boost shortcut routes to the real Spend GHC panel", /label="Spend GHC"/.test(wallet) && /setShowUtilityPanel\(true\)/.test(wallet)],
  ["wallet primary actions remain parent-wired and accessible", /onSend=\{\(\) =>/.test(wallet) && /onRequest=\{\(\) =>/.test(wallet) && /onReceive=\{\(\) =>/.test(wallet)],
  ["wallet tools expose explicit destinations", /if \(id === "utility"\)/.test(wallet) && /if \(id === "tx"\)/.test(wallet) && /if \(id === "methods"\)/.test(wallet) && /ghc-wallet-limits/.test(wallet) && /ghc-wallet-security/.test(wallet)],
  ["utility catalog has explicit retry on load failure", /setLoadError\(/.test(utility) && /Try again/.test(utility) && /Refresh GHC utility catalog/.test(utility)],
  ["spend requires a review confirmation before POST", /setConfirmItem\(item\)/.test(utility) && /Review GHC spend/.test(utility) && /Confirm spend/.test(utility)],
  ["utility target-dependent purchases validate target before confirmation", /needsTarget\(item\.purpose\) && !targetId\.trim\(\)/.test(utility) && /TARGET_REQUIRED/.test(route)],
  ["same utility retry retains idempotency key until confirmed success", /requestKeys = useRef\(new Map<string, string>\(\)\)/.test(utility) && /requestKeys\.current\.get\(keyScope\)/.test(utility) && /requestKeys\.current\.delete\(keyScope\)/.test(utility)],
  ["server validates idempotency key before fail-closed effect guard", /!rawClientReq \|\| rawClientReq\.length < 8/.test(route) && /INVALID_IDEMPOTENCY_KEY/.test(route) && route.indexOf("const rawClientReq") < route.indexOf("const effectNotConfigured")],
  ["utility reference is scoped to authenticated user and purpose", /scopedUser/.test(route) && /utility:\$\{purpose\}:\$\{scopedUser\}/.test(route)],
  ["unconfigured utility effects remain fail-closed and do not charge", /effectNotConfigured/.test(catalog) && /UTILITY_EFFECT_NOT_CONFIGURED/.test(route) && /no GHC has been charged/i.test(route)],
  ["wallet refresh events follow a successful utility spend", /ghc:wallet-synced/.test(utility) && /ghc:utility-spent/.test(utility)],
  ["prices remain server-catalog sourced and client amount is ignored", /getCatalogEntry\(purpose\)/.test(route) && /void body\.amount/.test(route)],
]
let failed = 0
for (const [label, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failed++ }
if (failed) process.exit(1)
console.log(`Wallet utility reliability: ${checks.length}/${checks.length} checks passed.`)
