/**
 * Phase 2 — durable Pioneer engagement signals for domain-claim readiness.
 * Does not claim Pi KYC status (portal-only).
 */

import { appendSecurityEvent } from "@/lib/server/security/control-plane"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { touchLastSeen } from "@/lib/server/identity/pi-identity-store"

export type PioneerActivityKind =
  | "session_verified"
  | "onboarding_completed"
  | "profile_updated"
  | "post_created"
  | "community_joined"
  | "message_sent"
  | "marketplace_browse"
  | "payment_completed"

export async function recordPioneerActivity(input: {
  userId: string
  kind: PioneerActivityKind
  metadata?: Record<string, unknown>
}): Promise<void> {
  const userId = String(input.userId || "").trim()
  if (!userId) return

  try {
    void touchLastSeen(userId)
  } catch {
    /* */
  }

  void appendSecurityEvent({
    eventType: `pioneer.activity.${input.kind}`,
    outcome: "allowed",
    actorUserId: userId,
    resourceType: "pioneer_engagement",
    resourceId: input.kind,
    metadata: {
      kind: input.kind,
      ...(input.metadata || {}),
      at: Date.now(),
    },
  })
}

export async function countEngagedPioneers(options?: {
  withinDays?: number
}): Promise<{
  totalIdentities: number | null
  engagedEstimate: number | null
  onboardingCompleted: number | null
}> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { totalIdentities: null, engagedEstimate: null, onboardingCompleted: null }
  }
  const base = env.supabaseUrl.replace(/\/$/, "")
  const headers = {
    apikey: env.supabaseServiceRoleKey,
    Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
    Prefer: "count=exact",
    Range: "0-0",
  }

  async function countQuery(qs: string): Promise<number | null> {
    try {
      const res = await fetch(`${base}/rest/v1/gh_pi_identities?${qs}`, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      })
      const range = res.headers.get("content-range") || ""
      const m = range.match(/\/(\d+)\s*$/)
      if (m) return Number(m[1])
      return null
    } catch {
      return null
    }
  }

  const totalIdentities = await countQuery("select=gh_user_id")
  const onboardingCompleted = await countQuery("select=gh_user_id&onboarding_completed=eq.true")

  return {
    totalIdentities,
    engagedEstimate: onboardingCompleted ?? totalIdentities,
    onboardingCompleted,
  }
}
