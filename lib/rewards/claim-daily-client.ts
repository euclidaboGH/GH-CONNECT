"use client"

/**
 * Canonical client boundary for Daily GHC.
 * The client never supplies an amount; the server/database is authoritative.
 */
import { IdentityService } from "@/lib/identity/identity-service"

export type DailyClaimStatusClientResult = {
  ok: boolean
  error?: string
  dayKey?: string
  lastClaimDayKey?: string | null
  claimedToday?: boolean
  claimable?: boolean
  cycleDay?: number
  completedCycles?: number
  totalSuccessfulClaims?: number
  economicVersion?: string
}

export type DailyClaimClientResult = {
  ok: boolean
  error?: string
  serverAmount?: number
  alreadyClaimed?: boolean
  cycleDay?: number
  pending?: boolean
  redeemableAt?: string
  referenceId?: string
}

function authHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    ...IdentityService.getAuthHeaders(),
  }
}

/** Read the authoritative daily-claim state. */
export async function getDailyClaimStatus(): Promise<DailyClaimStatusClientResult> {
  try {
    const response = await fetch("/api/economy/rewards/daily", {
      method: "GET",
      credentials: "include",
      headers: authHeaders(),
      cache: "no-store",
    })
    const data = (await response.json().catch(() => ({}))) as DailyClaimStatusClientResult & {
      message?: string
      code?: string
    }
    if (!response.ok || data.ok === false) {
      return {
        ok: false,
        error: data.message || data.error || data.code || "Could not load daily reward status.",
      }
    }
    return data
  } catch {
    return { ok: false, error: "Could not reach the rewards service." }
  }
}

/** Claim exactly once through the canonical server endpoint. */
export async function postDailyClaim(): Promise<DailyClaimClientResult> {
  try {
    const response = await fetch("/api/economy/rewards/daily", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({}),
    })
    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean
      amount?: number
      userAmount?: number
      alreadyClaimed?: boolean
      idempotent?: boolean
      pending?: boolean
      redeemableAt?: string
      cycleDay?: number
      referenceId?: string
      error?: string
      message?: string
      code?: string
    }
    if (response.status === 409 || data.code === "ALREADY_CLAIMED_TODAY") {
      return { ok: true, alreadyClaimed: true, cycleDay: Number(data.cycleDay) || undefined }
    }
    if (!response.ok || data.ok === false) {
      return {
        ok: false,
        error: data.message || data.error || "Daily claim failed. Your reward remains available to retry.",
      }
    }
    return {
      ok: true,
      serverAmount: Number(data.userAmount ?? data.amount) || undefined,
      alreadyClaimed: Boolean(data.alreadyClaimed || data.idempotent),
      pending: data.pending !== false,
      redeemableAt: data.redeemableAt != null ? String(data.redeemableAt) : undefined,
      cycleDay: data.cycleDay != null ? Number(data.cycleDay) : undefined,
      referenceId: data.referenceId != null ? String(data.referenceId) : undefined,
    }
  } catch {
    return { ok: false, error: "Could not reach the rewards service. Check your connection and retry." }
  }
}
