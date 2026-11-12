/**
 * Short-lived, request-bound proof that the withdrawal PIN was verified server-side.
 * The withdrawals route refuses to reserve funds without a valid proof for the same user and idempotency key.
 * proof = base64url(exp) + "." + HMAC_SHA256(secret, userId|idempotencyKey|exp)
 */
import { createHmac, timingSafeEqual } from "node:crypto"

const TTL_MS = 5 * 60_000
const secret = () => String(process.env.GH_PIN_PROOF_SECRET || "").trim()
export const pinProofConfigured = () => secret().length >= 32
const mac = (u: string, k: string, exp: number) => createHmac("sha256", secret()).update(`${u}|${k}|${exp}`).digest("base64url")

export function issuePinProof(userId: string, idempotencyKey: string): string | null {
  if (!pinProofConfigured()) return null
  const exp = Date.now() + TTL_MS
  return `${exp}.${mac(userId, idempotencyKey, exp)}`
}
export function checkPinProof(userId: string, idempotencyKey: string, proof: unknown): boolean {
  if (!pinProofConfigured() || typeof proof !== "string") return false
  const [expRaw, sig] = proof.split(".")
  const exp = Number(expRaw)
  if (!Number.isSafeInteger(exp) || exp < Date.now() || !sig) return false
  const a = Buffer.from(sig), b = Buffer.from(mac(userId, idempotencyKey, exp))
  return a.length === b.length && timingSafeEqual(a, b)
}
