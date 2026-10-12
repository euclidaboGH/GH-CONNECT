/**
 * Operator checklist — Section C (economy) + D (security).
 * Usage: node scripts/operator-verify-c-d-gates.mjs [--strict]
 */
import { spawnSync } from "child_process"

const strict = process.argv.includes("--strict")

const gates = [
  { id: "C13", title: "Daily claim status GET + UI hydrate", note: "GET /api/economy/rewards/daily — no mint" },
  { id: "C14", title: "Idempotency on claim/transfer/membership", note: "referenceId / idempotencyKey / step-up" },
  { id: "C15", title: "Wallet export + holds/appeals", note: "Routes present; live two-user E2E is operator" },
  { id: "C16", title: "Ledger reconciliation", note: "Ops RPC / internal alerts — monitor in Testnet" },
  { id: "C17", title: "Rate limits", note: "daily_claim, daily_status, wallet-export, report buckets" },
  { id: "C18", title: "Pending ≠ spendable", note: "docs/PENDING_VS_SPENDABLE_QA.md" },
  { id: "C19", title: "Referral payouts / Pi refunds off by default", note: "Do not enable until Testnet proven" },
  { id: "D20", title: "IDOR suite", note: "npm run test:idor-static; live Testnet IDOR is operator" },
  { id: "D21", title: "Messaging durable flag", note: "Keep OFF until IDOR + multi-instance green" },
  { id: "D22", title: "Block/mute/report paths", note: "social/blocks, mutes, reports" },
  { id: "D23", title: "Moderation intake", note: "POST /api/reports" },
  { id: "D24", title: "Media MIME + size caps", note: "app/api/media/route.ts" },
  { id: "D25", title: "CSP / Pi iframe headers", note: "vercel.json frame-ancestors; no X-Frame-Options SAMEORIGIN" },
  { id: "D26", title: "Dependency audit cadence", note: "docs/DEPENDENCY_AUDIT_CADENCE.md" },
]

console.log("=== GH-CONNECT Section C+D operator gates ===\n")
for (const g of gates) {
  console.log(`[${g.id}] ${g.title}`)
  if (g.note) console.log(`    ${g.note}`)
  console.log("")
}

if (strict) {
  for (const cmd of ["test:economy-cd", "test:security-cd"]) {
    const r = spawnSync("npm", ["run", cmd], { stdio: "inherit" })
    if (r.status !== 0) {
      console.error("STRICT fail:", cmd)
      process.exit(1)
    }
  }
  console.log("STRICT C+D static gates: PASS")
}

console.log("Live Testnet IDOR, two-user wallet export, and messaging durable E2E remain operator-side.")
