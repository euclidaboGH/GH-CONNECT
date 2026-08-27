/**
 * Phase D4 — GreenHaven ID + receive payload + QR safety (no balance movement).
 * Run: npx tsx lib/domains/receive-ghc-d4-tests.ts
 */
import {
  deriveGreenHavenId,
  getOrCreateGreenHavenId,
  isValidGreenHavenIdFormat,
  normalizeGreenHavenId,
  resolveUserIdFromGreenHavenId,
  GH_ID_REGEX,
} from "./greenhaven-id"
import {
  buildReceivePayload,
  parseReceivePayload,
  assertPayloadIsSafe,
} from "./ghc-receive-payload"
import { encodeQrMatrix } from "../qr-lite"
import {
  createEconomyDomain,
  type EconomyRepository,
} from "./economy-domain"

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

function memoryRepo(): EconomyRepository {
  const store: Record<string, { txs: any[] }> = {}
  return {
    mode: "local",
    listTransactions(userId) {
      return store[userId]?.txs || []
    },
    appendTransaction(tx) {
      if (!store[tx.userId]) store[tx.userId] = { txs: [] }
      store[tx.userId].txs.push(tx)
    },
    appendTransferPair(d, c) {
      this.appendTransaction(d)
      this.appendTransaction(c)
    },
    listRewards: () => [],
    appendReward: () => {},
    updateReward: () => {},
    getPremium: () => null,
    setPremium: () => {},
  }
}

async function run() {
  console.log("\nGHC Phase D4 Receive tests\n")

  const a = deriveGreenHavenId("user-alice")
  const b = deriveGreenHavenId("user-alice")
  assert(a === b, "ID derivation is stable")
  assert(GH_ID_REGEX.test(a), "ID matches GH-XXXXXX format")
  assert(deriveGreenHavenId("user-bob") !== a, "different users differ")

  assert(isValidGreenHavenIdFormat("GH-ABC123"), "valid format")
  assert(isValidGreenHavenIdFormat("gh-abc123"), "case normalize valid")
  assert(!isValidGreenHavenIdFormat("not-an-id"), "invalid format rejected")
  assert(normalizeGreenHavenId("@GH-ABC123") === "GH-ABC123", "normalize @ prefix")

  const id1 = getOrCreateGreenHavenId("persist-user-1")
  const id2 = getOrCreateGreenHavenId("persist-user-1")
  assert(id1 === id2, "getOrCreate stable for same user")

  const payload = buildReceivePayload(id1)
  assert(payload.startsWith("ghc://receive?"), "payload scheme")
  assert(assertPayloadIsSafe(payload), "payload has no secrets")
  assert(!payload.toLowerCase().includes("amount"), "no amount in payload")
  assert(!payload.toLowerCase().includes("token"), "no token in payload")

  const parsed = parseReceivePayload(payload)
  assert(parsed.ok === true, "parse valid payload")
  if (parsed.ok) {
    assert(parsed.payload.greenHavenId === id1, "round-trip id")
    assert(parsed.payload.version === 1, "version 1")
  }

  assert(parseReceivePayload("https://evil.example/x").ok === false, "reject https QR")
  assert(parseReceivePayload("javascript:alert(1)").ok === false, "reject javascript")
  assert(parseReceivePayload("ghc://receive?v=99&id=GH-ABC123").ok === false, "unsupported version")
  assert(parseReceivePayload("ghc://receive?v=1&id=BAD").ok === false, "invalid id in qr")
  assert(parseReceivePayload("ghc://receive?v=1&id=GH-ABC123&amount=50").ok === false, "reject amount param")
  assert(parseReceivePayload("GH-ABC123").ok === true, "bare id accepted")

  // lookup
  const dir = [{ id: "u1", name: "Ada", greenHavenId: id1 }]
  // map id1 to persist-user-1 in cache; directory uses id1 as greenHavenId of u1
  const hit = resolveUserIdFromGreenHavenId(id1, [
    { id: "u1", name: "Ada", greenHavenId: id1 },
  ])
  assert(!!hit && hit.userId === "u1", "directory resolve")

  // QR matrix generates
  const matrix = encodeQrMatrix(payload)
  assert(matrix.length >= 21 && matrix[0].length === matrix.length, "qr matrix square")

  // Receive does not alter balance
  {
    const eco = createEconomyDomain({
      currentUserId: "alice",
      repository: memoryRepo(),
      recipientExists: () => true,
    })
    await eco.recordTransaction({
      kind: "earned",
      amount: 50,
      reason: "seed",
      sourceEvent: "TEST",
      status: "posted",
    })
    const before = eco.getWallet().balance
    // simulating open receive — no domain call should run
    void getOrCreateGreenHavenId("alice")
    void buildReceivePayload(getOrCreateGreenHavenId("alice"))
    assert(eco.getWallet().balance === before, "receive helpers do not change balance")
    assert(eco.getTransactions().length === 1, "no new transactions from receive helpers")
  }

  console.log(`\nPhase D4 result: ${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exitCode = 1
}
run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
