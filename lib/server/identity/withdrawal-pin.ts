/**
 * GreenHaven withdrawal PIN — app-side confirmation only.
 * Never sent to Pi Platform. Not the Pi wallet passphrase.
 * Scrypt hash with per-user salt; attempt limits + lockout.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { readGhcServerEnv } from "@/lib/server/economy/env"

const MAX_ATTEMPTS = 5
const LOCK_MS = 15 * 60_000

export type PinStatus = {
  ok: boolean
  configured: boolean
  locked: boolean
  lockedUntil?: string | null
  error?: string
}

function restHeaders(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  }
}

function hashPin(pin: string, saltHex: string): string {
  const salt = Buffer.from(saltHex, "hex")
  return scryptSync(pin, salt, 32).toString("hex")
}

export function isValidPinFormat(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{6}$/.test(pin)
}

/** Rejects trivially guessable PINs (repeated digits, straight runs, common patterns). */
export function isWeakPin(pin: string): boolean {
  if (/^(\d)\1{5}$/.test(pin)) return true
  const asc = "0123456789012345", desc = "9876543210987654"
  if (asc.includes(pin) || desc.includes(pin)) return true
  if (/^(\d{2})\1\1$/.test(pin) || /^(\d{3})\1$/.test(pin)) return true
  return ["123123", "121212", "112233", "696969", "654321", "123321"].includes(pin)
}

export async function getWithdrawalPinStatus(userId: string): Promise<PinStatus> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, configured: false, locked: false, error: "PIN_SERVICE_UNAVAILABLE" }
  }
  try {
    const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_withdrawal_pins?user_id=eq.${encodeURIComponent(userId)}&select=failed_attempts,locked_until`
    const res = await fetch(url, {
      headers: restHeaders(env.supabaseServiceRoleKey),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      // A missing table/schema is not the same as an unconfigured PIN. Fail closed
      // so the UI never invites setup against unavailable persistence.
      if (res.status === 404 || res.status === 400 || res.status === 406) {
        return { ok: false, configured: false, locked: false, error: "PIN_TABLE_PENDING" }
      }
      return { ok: false, configured: false, locked: false, error: "PIN_SERVICE_UNAVAILABLE" }
    }
    const rows = (await res.json().catch(() => [])) as Array<{
      failed_attempts?: number
      locked_until?: string | null
    }>
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: true, configured: false, locked: false }
    }
    const lockedUntil = rows[0].locked_until || null
    const locked = lockedUntil ? new Date(lockedUntil).getTime() > Date.now() : false
    return { ok: true, configured: true, locked, lockedUntil }
  } catch {
    return { ok: false, configured: false, locked: false, error: "PIN_SERVICE_UNAVAILABLE" }
  }
}

export async function setWithdrawalPin(input: {
  userId: string
  pin: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidPinFormat(input.pin)) return { ok: false, error: "PIN_FORMAT_INVALID" }
  if (isWeakPin(input.pin)) return { ok: false, error: "PIN_TOO_WEAK" }
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "PIN_SERVICE_UNAVAILABLE" }
  }
  const salt = randomBytes(16).toString("hex")
  const pinHash = hashPin(input.pin, salt)
  try {
    const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_withdrawal_pins`
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...restHeaders(env.supabaseServiceRoleKey),
        // First PIN setup is insert-only. Never let a repeated setup request replace
        // an existing credential; PIN changes need a separate verified flow.
        Prefer: "resolution=ignore-duplicates,return=representation",
      },
      body: JSON.stringify({
        user_id: input.userId,
        pin_hash: pinHash,
        pin_salt: salt,
        failed_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return { ok: false, error: "PIN_PERSIST_FAILED" }
    const inserted = (await res.json().catch(() => [])) as unknown
    if (!Array.isArray(inserted) || inserted.length === 0) {
      return { ok: false, error: "PIN_ALREADY_CONFIGURED" }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: "PIN_SERVICE_UNAVAILABLE" }
  }
}

export async function verifyWithdrawalPin(input: {
  userId: string
  pin: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidPinFormat(input.pin)) return { ok: false, error: "PIN_FORMAT_INVALID" }
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false, error: "PIN_SERVICE_UNAVAILABLE" }
  const base = env.supabaseUrl.replace(/\/$/, "")
  const call = async (fn: string, body: Record<string, unknown>) => {
    const res = await fetch(`${base}/rest/v1/rpc/${fn}`, {
      method: "POST", headers: restHeaders(env.supabaseServiceRoleKey!), body: JSON.stringify(body),
      cache: "no-store", signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`RPC_${res.status}`)
    return res.json().catch(() => null)
  }
  try {
    // The attempt is counted atomically (row lock) BEFORE comparing, so parallel guesses cannot exceed the limit.
    const begin = (await call("gh_withdrawal_pin_begin_attempt", {
      p_user_id: input.userId, p_max_attempts: MAX_ATTEMPTS, p_lock_seconds: LOCK_MS / 1000,
    })) as { ok?: boolean; error?: string; pinHash?: string; pinSalt?: string } | null
    if (!begin?.ok) return { ok: false, error: begin?.error || "PIN_SERVICE_UNAVAILABLE" }
    const a = Buffer.from(hashPin(input.pin, String(begin.pinSalt)), "hex")
    const b = Buffer.from(String(begin.pinHash), "hex")
    if (!(a.length === b.length && timingSafeEqual(a, b))) return { ok: false, error: "PIN_INVALID" }
    await call("gh_withdrawal_pin_attempt_succeeded", { p_user_id: input.userId })
    return { ok: true }
  } catch {
    return { ok: false, error: "PIN_SERVICE_UNAVAILABLE" }
  }
}
