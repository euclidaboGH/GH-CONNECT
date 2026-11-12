#!/usr/bin/env node
/**
 * Phase 28 — runtime contract tests for Pi wallet consent verification.
 * Run: node --disable-warning=ExperimentalWarning --experimental-strip-types scripts/test-phase28-wallet-consent.mjs
 */
import assert from "node:assert/strict"
import {
  verifyWalletConsentProof,
  walletConsentFailureStatus,
  WALLET_CONSENT_MESSAGES,
} from "../lib/server/identity/wallet-consent.ts"

let passed = 0
async function t(name, fn) {
  await fn()
  passed++
  console.log(`PASS ${name}`)
}

const PI_WALLET_ADDRESS = `G${"A".repeat(55)}`

function deps(overrides = {}) {
  const calls = { verify: 0, byGh: 0, byPi: 0 }
  return {
    calls,
    deps: {
      verifyPiAccessToken: async () => { calls.verify++; return { uid: "pi-uid-1", username: "alice" } },
      getByGhUserId: async () => { calls.byGh++; return { ghUserId: "gh-1", piAppUid: "pi-uid-1", piUsername: "alice" } },
      getByPiAppUid: async () => { calls.byPi++; return { ghUserId: "gh-1", piAppUid: "pi-uid-1" } },
      ...overrides,
    },
  }
}
const good = { ghUserId: "gh-1", accessToken: "tok", consent: true, walletAddress: PI_WALLET_ADDRESS }

await t("no explicit consent boolean → CONSENT_REQUIRED (no Pi call)", async () => {
  for (const consent of [undefined, false, "true", 1, null]) {
    const { deps: d, calls } = deps()
    const r = await verifyWalletConsentProof({ ...good, consent }, d)
    assert.deepEqual(r, { ok: false, error: "CONSENT_REQUIRED" })
    assert.equal(calls.verify, 0)
  }
})
await t("missing / oversized token → PI_TOKEN_REQUIRED", async () => {
  for (const accessToken of [undefined, "", "   ", 42, "x".repeat(5000)]) {
    const { deps: d } = deps()
    const r = await verifyWalletConsentProof({ ...good, accessToken }, d)
    assert.deepEqual(r, { ok: false, error: "PI_TOKEN_REQUIRED" })
  }
})
await t("Pi platform rejects token → PI_TOKEN_INVALID and no mapping read", async () => {
  const { deps: d, calls } = deps({ verifyPiAccessToken: async () => null })
  const r = await verifyWalletConsentProof(good, d)
  assert.deepEqual(r, { ok: false, error: "PI_TOKEN_INVALID" })
  assert.equal(calls.byGh, 0)
})
await t("missing SDK address still checks Pi Platform and fails closed when both sources omit it", async () => {
  const { deps: d, calls } = deps()
  const { walletAddress, ...withoutAddress } = good
  assert.deepEqual(await verifyWalletConsentProof(withoutAddress, d), { ok: false, error: "PI_WALLET_ADDRESS_REQUIRED" })
  assert.equal(calls.verify, 1)
})
await t("Pi Platform address is accepted when SDK auth response omits it", async () => {
  const { deps: d, calls } = deps({ verifyPiAccessToken: async () => { calls.verify++; return { uid: "pi-uid-1", username: "alice", walletAddress: PI_WALLET_ADDRESS } } })
  const { walletAddress, ...withoutAddress } = good
  const result = await verifyWalletConsentProof(withoutAddress, d)
  assert.equal(result.ok, true)
  assert.equal(result.piWalletAddress, PI_WALLET_ADDRESS)
  assert.equal(result.walletAddressSource, "platform_api")
  assert.equal(calls.verify, 1)
})
await t("server-returned wallet address must match Pi SDK address", async () => {
  const { deps: d } = deps({ verifyPiAccessToken: async () => ({ uid: "pi-uid-1", walletAddress: `G${"B".repeat(55)}` }) })
  assert.deepEqual(await verifyWalletConsentProof(good, d), { ok: false, error: "PI_WALLET_ADDRESS_MISMATCH" })
})
await t("no durable mapping → IDENTITY_MAPPING_REQUIRED", async () => {
  const { deps: d } = deps({ getByGhUserId: async () => null })
  assert.deepEqual(await verifyWalletConsentProof(good, d), { ok: false, error: "IDENTITY_MAPPING_REQUIRED" })
})
await t("verified Pi UID differs from linked identity → IDENTITY_MISMATCH", async () => {
  const { deps: d } = deps({ verifyPiAccessToken: async () => ({ uid: "someone-else" }) })
  assert.deepEqual(await verifyWalletConsentProof(good, d), { ok: false, error: "IDENTITY_MISMATCH" })
})
await t("Pi UID that belongs to another GH account cannot be authorized by this account", async () => {
  const { deps: d } = deps({ getByPiAppUid: async () => ({ ghUserId: "gh-OTHER", piAppUid: "pi-uid-1" }) })
  assert.deepEqual(await verifyWalletConsentProof(good, d), { ok: false, error: "IDENTITY_MISMATCH" })
  const { deps: d2 } = deps({ getByPiAppUid: async () => null })
  assert.deepEqual(await verifyWalletConsentProof(good, d2), { ok: false, error: "IDENTITY_MISMATCH" })
})
await t("identity store outage fails closed", async () => {
  const { deps: d } = deps({ getByGhUserId: async () => { throw new Error("db down") } })
  assert.deepEqual(await verifyWalletConsentProof(good, d), { ok: false, error: "IDENTITY_LOOKUP_UNAVAILABLE" })
})
await t("valid proof returns the DURABLE mapped UID, ignoring any browser-supplied UID", async () => {
  const { deps: d } = deps()
  const r = await verifyWalletConsentProof({ ...good, piAppUid: "attacker-uid", recipient: "x", authorized: true }, d)
  assert.equal(r.ok, true)
  assert.equal(r.piAppUid, "pi-uid-1")
  assert.equal(r.piUsername, "alice")
  assert.equal(r.piWalletAddress, PI_WALLET_ADDRESS)
  assert.equal(r.walletAddressSource, "pi_sdk_scope")
})
await t("Platform API wallet address match is marked as API verified", async () => {
  const { deps: d } = deps({ verifyPiAccessToken: async () => ({ uid: "pi-uid-1", walletAddress: PI_WALLET_ADDRESS }) })
  const r = await verifyWalletConsentProof(good, d)
  assert.equal(r.ok, true)
  assert.equal(r.walletAddressSource, "platform_api")
})
await t("every failure has a safe message and an HTTP status; none leak internals", async () => {
  for (const [code, msg] of Object.entries(WALLET_CONSENT_MESSAGES)) {
    assert.ok(msg.length > 10)
    assert.ok(!/PGRST|postgres|service_role|Bearer|token=/i.test(msg))
    assert.ok([400, 401, 403, 409, 422, 503].includes(walletConsentFailureStatus(code)))
    assert.notEqual(code, "WALLET_AUTHORIZATION_REQUIRED")
  }
})

console.log(`\nPhase 28 wallet consent tests: ${passed}/13 passed`)
