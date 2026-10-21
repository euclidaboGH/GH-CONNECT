/**
 * Client: server-authoritative daily claim (POST /api/economy/rewards/daily).
 */
import { IdentityService } from "@/lib/identity/identity-service"

export type DailyClaimClientResult = {
  ok: boolean
  error?: string
  serverAmount?: number
  alreadyClaimed?: boolean
  cycleDay?: number
  pending?: boolean
  redeemableAt?: string
}

export async function postDailyClaim(): Promise<DailyClaimClientResult> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...IdentityService.getAuthHeaders(),
    }
    const response = await fetch("/api/economy/rewards/daily", {
      method: "POST",
      credentials: "include",
      headers,
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
    }
  } catch {
    return {
      ok: false,
      error: "Could not reach the rewards service. Check your connection and retry; your claim was not confirmed.",
    }
  }
}
