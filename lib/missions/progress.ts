/**
 * Mission progress client — records durable completion when server accepts it.
 * Mission completion unlocks non-financial achievements only. GHC issuance remains disabled for activity missions by current policy.
 */
import { IdentityService } from "@/lib/identity/identity-service"

export type MissionCode =
  | "join_community"
  | "first_post"
  | "first_comment"
  | "meaningful_contribution"
  | "complete_profile"
  | "send_connection"
  | "accept_connection"

export async function reportMissionProgress(
  code: MissionCode,
  meta?: Record<string, string | number | boolean | null | undefined>
): Promise<{
  ok: boolean
  completed?: boolean
  verified?: boolean
  alreadyCompleted?: boolean
  achievementId?: string
  grantedGhc?: number
  rewardStatus?: string
  message?: string
  error?: string
}> {
  try {
    const res = await fetch("/api/economy/missions/progress", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...IdentityService.getAuthHeaders(),
      },
      body: JSON.stringify({ code, meta: meta || {} }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      completed?: boolean
      verified?: boolean
      alreadyCompleted?: boolean
      achievementId?: string
      grantedGhc?: number
      rewardStatus?: string
      message?: string
      error?: string
    }
    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP_${res.status}`, message: data.message }
    }
    return {
      ok: data.ok !== false,
      completed: data.completed,
      verified: data.verified,
      alreadyCompleted: data.alreadyCompleted,
      achievementId: data.achievementId,
      grantedGhc: data.grantedGhc,
      rewardStatus: data.rewardStatus,
      message: data.message,
      error: data.error,
    }
  } catch {
    return { ok: false, error: "NETWORK" }
  }
}
