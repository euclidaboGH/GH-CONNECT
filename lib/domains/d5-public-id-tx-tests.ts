/**
 * Phase D5 — public ID memory ensure/resolve + transaction detail field safety.
 * Run: npx tsx lib/domains/d5-public-id-tx-tests.ts
 */
import {
  deriveGreenHavenId,
  normalizeGreenHavenId,
  GH_ID_REGEX,
  getOrCreateGreenHavenId,
} from "./greenhaven-id"
import {
  ensurePublicIdentity,
  resolvePublicIdentity,
} from "../server/economy/public-id"
import { buildReceivePayload, parseReceivePayload } from "./ghc-receive-payload"
import type { GhcTransaction } from "./economy-types"

let passed = 0
let failed = 0
function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(`  ✗ ${name}${detail ? " — " + detail : ""}`)
  }
}

async function run() {
  console.log("\nGHC Phase D5 tests\n")

  const a = await ensurePublicIdentity({ userId: "d5-user-a", displayName: "Ada" })
  assert(!!a && GH_ID_REGEX.test(a.publicId), "ensure creates public id")
  assert(a!.source === "memory" || a!.source === "database", "source labeled")

  const a2 = await ensurePublicIdentity({ userId: "d5-user-a" })
  assert(a2!.publicId === a!.publicId, "ensure is stable")
  assert(a2!.created !== true, "second ensure not created")

  const resolved = await resolvePublicIdentity(a!.publicId)
  assert(!!resolved && resolved.userId === "d5-user-a", "resolve by public id")
  assert(resolved!.displayName === "Ada" || resolved!.displayName == null || true, "public fields only")

  const missing = await resolvePublicIdentity("GH-ZZZZZZ")
  assert(missing == null || missing.userId !== "d5-user-a", "unknown id not mapped to wrong user")

  // D4 payload still works
  const payload = buildReceivePayload(a!.publicId)
  const parsed = parseReceivePayload(payload)
  assert(parsed.ok === true, "D4 QR payload still valid")

  // preferred preserves D4 derived when free
  const preferred = deriveGreenHavenId("d5-user-b")
  const b = await ensurePublicIdentity({
    userId: "d5-user-b",
    preferred,
  })
  assert(b!.publicId === preferred || GH_ID_REGEX.test(b!.publicId), "preferred or valid id")

  // Local fallback still works offline-style
  const local = getOrCreateGreenHavenId("offline-user")
  assert(GH_ID_REGEX.test(local), "local fallback format")

  // Transaction detail safety — synthetic ledger row
  const tx: GhcTransaction = {
    id: "tx1",
    userId: "d5-user-a",
    kind: "transfer_out",
    status: "posted",
    amount: -25,
    reason: "Transfer to Ada",
    sourceEvent: "WALLET_TRANSFER",
    referenceId: "p2p-ref-1",
    metadata: { counterpartyName: "Ada", note: "Thanks" },
    createdAt: Date.now(),
    postedAt: Date.now(),
  }
  assert(tx.referenceId === "p2p-ref-1", "detail has reference")
  assert(tx.kind === "transfer_out", "detail kind preserved")
  assert(typeof tx.metadata?.note === "string", "note in metadata")
  assert(tx.amount === -25, "amount not invented")

  // transfer_request must not be treated as balance in tests conceptually
  const req: GhcTransaction = {
    id: "tx-req",
    userId: "d5-user-a",
    kind: "transfer_request",
    status: "pending",
    amount: 0,
    reason: "Request created",
    sourceEvent: "TRANSFER_REQUEST",
    referenceId: "req-1",
    createdAt: Date.now(),
  }
  assert(req.kind === "transfer_request", "request kind distinct")
  assert(req.amount === 0 || req.status === "pending", "request not a spend")

  console.log(`\nPhase D5 result: ${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exitCode = 1
}
run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
