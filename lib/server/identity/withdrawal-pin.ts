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
    if (res.status === 404 || res.status === 406) {
      return { ok: true, configured: false, locked: false }
    }
    if (!res.ok) {
      // Table may not be applied yet
      if (res.status === 404 || res.status === 400) {
        return { ok: true, configured: false, locked: false, error: "PIN_TABLE_PENDING" }
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
        Prefer: "resolution=merge-duplicates,return=minimal",
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
    if (!res.ok) {
      // upsert via PATCH if exists
      const patch = await fetch(
        `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_withdrawal_pins?user_id=eq.${encodeURIComponent(input.userId)}`,
        {
          method: "PATCH",
          headers: restHeaders(env.supabaseServiceRoleKey),
          body: JSON.stringify({
            pin_hash: pinHash,
            pin_salt: salt,
            failed_attempts: 0,
            locked_until: null,
            updated_at: new Date().toISOString(),
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        },
      )
      if (!patch.ok) return { ok: false, error: "PIN_PERSIST_FAILED" }
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
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "PIN_SERVICE_UNAVAILABLE" }
  }
  try {
    const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_withdrawal_pins?user_id=eq.${encodeURIComponent(input.userId)}&select=pin_hash,pin_salt,failed_attempts,locked_until`
    const res = await fetch(url, {
      headers: restHeaders(env.supabaseServiceRoleKey),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return { ok: false, error: "PIN_SERVICE_UNAVAILABLE" }
    const rows = (await res.json().catch(() => [])) as Array<{
      pin_hash: string
      pin_salt: string
      failed_attempts: number
      locked_until: string | null
    }>
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: false, error: "PIN_NOT_CONFIGURED" }
    }
    const row = rows[0]
    if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
      return { ok: false, error: "PIN_LOCKED" }
    }
    const computed = hashPin(input.pin, row.pin_salt)
    const a = Buffer.from(computed, "hex")
    const b = Buffer.from(row.pin_hash, "hex")
    const match = a.length === b.length && timingSafeEqual(a, b)
    if (match) {
      await fetch(
        `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_withdrawal_pins?user_id=eq.${encodeURIComponent(input.userId)}`,
        {
          method: "PATCH",
          headers: restHeaders(env.supabaseServiceRoleKey),
          body: JSON.stringify({ failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() }),
          cache: "no-store",
        },
      ).catch(() => null)
      return { ok: true }
    }
    const attempts = (row.failed_attempts || 0) + 1
    const lockedUntil = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MS).toISOString() : null
    await fetch(
      `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/gh_withdrawal_pins?user_id=eq.${encodeURIComponent(input.userId)}`,
      {
        method: "PATCH",
        headers: restHeaders(env.supabaseServiceRoleKey),
        body: JSON.stringify({
          failed_attempts: Math.min(attempts, MAX_ATTEMPTS),
          locked_until: lockedUntil,
          updated_at: new Date().toISOString(),
        }),
        cache: "no-store",
      },
    ).catch(() => null)
    return { ok: false, error: lockedUntil ? "PIN_LOCKED" : "PIN_INVALID" }
  } catch {
    return { ok: false, error: "PIN_SERVICE_UNAVAILABLE" }
  }
}
