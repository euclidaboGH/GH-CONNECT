/**
 * Client helpers for referral programme (share + status only; no invented rewards).
 */
import { IdentityService } from "@/lib/identity/identity-service"

function authHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(IdentityService.getAuthHeaders?.() || {}),
  }
}

export type ReferralStatus = {
  ok: boolean
  durable?: boolean
  code?: string
  sharePath?: string
  attributed?: boolean
  referrerUserId?: string | null
  invitedCount?: number
  pendingRewardCount?: number
  postedRewardCount?: number
  pendingRewardGhc?: number
  postedRewardGhc?: number
  settlementEnabled?: boolean
  error?: string
}

export async function fetchReferralCode(): Promise<{
  ok: boolean
  code?: string
  sharePath?: string
  error?: string
}> {
  const res = await fetch("/api/referral/code", {
    credentials: "include",
    cache: "no-store",
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  return {
    ok: res.ok && data?.ok === true,
    code: data?.code ? String(data.code) : undefined,
    sharePath: data?.sharePath ? String(data.sharePath) : undefined,
    error: data?.error ? String(data.error) : res.ok ? undefined : "REQUEST_FAILED",
  }
}

export async function fetchReferralStatus(): Promise<ReferralStatus> {
  const res = await fetch("/api/referral/status", {
    credentials: "include",
    cache: "no-store",
    headers: authHeaders(),
  })
  const data = await res.json().catch(() => ({}))
  return {
    ok: res.ok && data?.ok === true,
    durable: Boolean(data?.durable),
    code: data?.code ? String(data.code) : undefined,
    sharePath: data?.sharePath ? String(data.sharePath) : undefined,
    attributed: Boolean(data?.attributed),
    referrerUserId: data?.referrerUserId != null ? String(data.referrerUserId) : null,
    invitedCount: Number(data?.invitedCount) || 0,
    pendingRewardCount: Number(data?.pendingRewardCount) || 0,
    postedRewardCount: Number(data?.postedRewardCount) || 0,
    pendingRewardGhc: Number(data?.pendingRewardGhc) || 0,
    postedRewardGhc: Number(data?.postedRewardGhc) || 0,
    settlementEnabled: Boolean(data?.settlementEnabled),
    error: data?.error ? String(data.error) : res.ok ? undefined : "REQUEST_FAILED",
  }
}

export async function attributeReferralCode(input: {
  code?: string
  greenHavenId?: string
  referrerKey?: string
}): Promise<{ ok: boolean; idempotent?: boolean; message?: string; error?: string }> {
  const res = await fetch("/api/referral/attribute", {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify({
      code: input.code,
      greenHavenId: input.greenHavenId,
      referrerKey: input.referrerKey || input.greenHavenId || input.code,
    }),
  })
  const data = await res.json().catch(() => ({}))
  return {
    ok: res.ok && data?.ok !== false,
    idempotent: Boolean(data?.idempotent),
    message: data?.message ? String(data.message) : undefined,
    error: data?.error ? String(data.error) : res.ok ? undefined : "REQUEST_FAILED",
  }
}
