import fs from "node:fs"
const read = p => fs.readFileSync(p, "utf8")
const resolver = read("lib/domains/ghc-activity-attribution.ts")
const detail = read("components/ghc/ghc-transaction-detail.tsx")
const wallet = read("features/wallet/wallet-screen.tsx")
const notification = read("lib/notification-center.ts")
const checks = [
  ["resolver is read-only transaction attribution", resolver.includes("resolveGhcActivityAttribution") && resolver.includes("never creates rewards")],
  ["post attribution supports comment deep link", resolver.includes('kind: "post"') && resolver.includes("commentId")],
  ["community attribution supported", resolver.includes('kind: "community"') && resolver.includes('"ghc:open-community"')],
  ["marketplace attribution supported", resolver.includes('kind: "marketplace"') && resolver.includes('"ghc:open-marketplace"')],
  ["transfer counterparty profile supported", resolver.includes('kind: "profile"') && resolver.includes('"ghc:open-profile"')],
  ["reward and payment references classified", resolver.includes('kind: "reward"') && resolver.includes('kind: "payment"')],
  ["wallet transaction detail uses resolver", detail.includes("resolveGhcActivityAttribution(tx)")],
  ["transaction detail exposes linked activity", detail.includes("Linked activity") && detail.includes("Open source activity")],
  ["wallet keeps transaction detail integration", wallet.includes("<GhcTransactionDetail")],
  ["post navigation preserves canonical open-post event", resolver.includes('"ghc:open-post"')],
  ["comment navigation preserves comment action", resolver.includes('action: target.commentId ? "comment" : "focus"')],
  ["notification center remains canonical deep-link reference", notification.includes("resolveNotificationDeepLink") && notification.includes("commentId")],
]
let passed=0
for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} ${name}`); if(ok) passed++ }
console.log(`\n${passed}/${checks.length} PASS`)
if (passed !== checks.length) process.exit(1)
