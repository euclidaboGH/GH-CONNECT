/**
 * Phase 2 — Pi wallet authorization (server-only).
 * Explicit consent that A2U payouts may go to the verified mapped Pi app uid.
 * Never trusts client-supplied recipient UIDs or stores tokens/seeds.
 */
import { readGhcServerEnv, hasPrivilegedDatabase } from "@/lib/server/economy/env"

export type WalletAuthorizationStatus = {
  ok: boolean
  error?: string
  hasMapping?: boolean
  mappedPiAppUid?: string | null
  mappedUsername?: string | null
  authorizationActive?: boolean
  authorizationId?: string | null
  authorizedPiAppUid?: string | null
  consentedAt?: string | null
  lastVerifiedAt?: string | null
  uidMatchesAuthorization?: boolean
}

async function rpc<T extends Record<string, unknown>>(
  name: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  if (!hasPrivilegedDatabase()) return null
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    })
    const result = (await response.json().catch(() => null)) as T | null
    if (!response.ok || result === null) return null
    return result
  } catch {
    return null
  }
}

export async function getWalletAuthorization(ghUserId: string): Promise<WalletAuthorizationStatus> {
  const userId = String(ghUserId || "").trim()
  if (!userId) return { ok: false, error: "INVALID_INPUT" }
  const result = await rpc<WalletAuthorizationStatus>("gh_pi_wallet_authorization_get", {
    p_user_id: userId,
  })
  if (!result) return { ok: false, error: "WALLET_AUTHORIZATION_UNAVAILABLE" }
  return result
}

export async function grantWalletAuthorization(input: {
  ghUserId: string
  piAppUid: string
  source?: "user_explicit" | "auth_bridge" | "operator"
}): Promise<{ ok: boolean; error?: string; authorizationId?: string; piAppUid?: string }> {
  const result = await rpc<{
    ok?: boolean
    error?: string
    authorizationId?: string
    piAppUid?: string
  }>("gh_pi_wallet_authorization_grant", {
    p_user_id: String(input.ghUserId || "").trim(),
    p_pi_app_uid: String(input.piAppUid || "").trim(),
    p_source: input.source || "user_explicit",
  })
  if (!result) return { ok: false, error: "WALLET_AUTHORIZATION_UNAVAILABLE" }
  if (result.ok !== true) return { ok: false, error: String(result.error || "GRANT_FAILED") }
  return {
    ok: true,
    authorizationId: result.authorizationId,
    piAppUid: result.piAppUid,
  }
}

export async function revokeWalletAuthorization(input: {
  ghUserId: string
  reason?: string
}): Promise<{ ok: boolean; revoked?: boolean; error?: string }> {
  const result = await rpc<{ ok?: boolean; revoked?: boolean; error?: string }>(
    "gh_pi_wallet_authorization_revoke",
    {
      p_user_id: String(input.ghUserId || "").trim(),
      p_reason: input.reason || "user_revoked",
    },
  )
  if (!result) return { ok: false, error: "WALLET_AUTHORIZATION_UNAVAILABLE" }
  return {
    ok: result.ok === true,
    revoked: result.revoked === true,
    error: result.error,
  }
}

/** Gate A2U payouts: mapping + active consent must match recipient uid. */
export async function assertPayoutWalletAuthorization(input: {
  ghUserId: string
  recipientUid: string
}): Promise<{ ok: boolean; error?: string; authorizationId?: string }> {
  const result = await rpc<{ ok?: boolean; error?: string; authorizationId?: string }>(
    "gh_pi_wallet_authorization_assert_payout",
    {
      p_user_id: String(input.ghUserId || "").trim(),
      p_recipient_uid: String(input.recipientUid || "").trim(),
    },
  )
  if (!result) return { ok: false, error: "WALLET_AUTHORIZATION_UNAVAILABLE" }
  if (result.ok !== true) return { ok: false, error: String(result.error || "WALLET_AUTHORIZATION_REQUIRED") }
  return { ok: true, authorizationId: result.authorizationId }
}
