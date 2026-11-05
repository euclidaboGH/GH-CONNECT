/**
 * Phase 2 — Pi wallet authorization (server-only).
 * Explicit consent that A2U payouts may go to the verified mapped Pi app uid.
 * Never trusts client-supplied recipient UIDs or stores tokens/seeds.
 */
import { readGhcServerEnv } from "@/lib/server/economy/env"

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

type RpcFailure = {
  ok: false
  error: "WALLET_AUTHORIZATION_UNAVAILABLE"
  diagnosticCode?: string
  httpStatus?: number
}

type RpcSuccess<T> = { ok: true; value: T }
type RpcResult<T> = RpcSuccess<T> | RpcFailure

/**
 * Calls a narrowly-scoped service-role RPC. Failure details are retained only
 * as safe machine codes/statuses; raw PostgREST bodies and credentials are never
 * returned to callers or logged.
 */
async function rpc<T extends Record<string, unknown>>(
  name: string,
  body: Record<string, unknown>,
): Promise<RpcResult<T>> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    console.error("[pi-wallet-authorization] privileged Supabase configuration missing", {
      rpc: name,
      hasSupabaseUrl: Boolean(env.supabaseUrl),
      hasServiceRoleKey: Boolean(env.supabaseServiceRoleKey),
    })
    return { ok: false, error: "WALLET_AUTHORIZATION_UNAVAILABLE", diagnosticCode: "SERVER_CONFIG_MISSING" }
  }

  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\\/$/, "")}/rest/v1/rpc/${name}`, {
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
    const raw = await response.text()
    let result: T | null = null
    try {
      result = raw ? (JSON.parse(raw) as T) : null
    } catch {
      console.error("[pi-wallet-authorization] RPC returned invalid JSON", {
        rpc: name,
        httpStatus: response.status,
      })
      return { ok: false, error: "WALLET_AUTHORIZATION_UNAVAILABLE", diagnosticCode: "INVALID_UPSTREAM_JSON", httpStatus: response.status }
    }

    if (!response.ok || result === null) {
      let upstreamCode: string | undefined
      if (result && typeof result === "object") {
        const payload = result as Record<string, unknown>
        if (typeof payload.code === "string") upstreamCode = payload.code.slice(0, 80)
      }
      console.error("[pi-wallet-authorization] RPC request failed", {
        rpc: name,
        httpStatus: response.status,
        upstreamCode,
      })
      return {
        ok: false,
        error: "WALLET_AUTHORIZATION_UNAVAILABLE",
        diagnosticCode: upstreamCode || `HTTP_${response.status}`,
        httpStatus: response.status,
      }
    }
    return { ok: true, value: result }
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError"
    console.error("[pi-wallet-authorization] RPC transport failure", { rpc: name, errorName })
    return {
      ok: false,
      error: "WALLET_AUTHORIZATION_UNAVAILABLE",
      diagnosticCode: errorName === "TimeoutError" ? "UPSTREAM_TIMEOUT" : "UPSTREAM_TRANSPORT_FAILURE",
    }
  }
}

export async function getWalletAuthorization(ghUserId: string): Promise<WalletAuthorizationStatus> {
  const userId = String(ghUserId || "").trim()
  if (!userId) return { ok: false, error: "INVALID_INPUT" }
  const result = await rpc<WalletAuthorizationStatus>("gh_pi_wallet_authorization_get", {
    p_user_id: userId,
  })
  if (!result.ok) return { ok: false, error: result.error }
  const value = result.value
  const uidMatches = value.uidMatchesAuthorization === true
  return {
    ...value,
    ok: value.ok === true,
    authorizationActive: value.authorizationActive === true && uidMatches,
    uidMatchesAuthorization: uidMatches,
  }
}

export async function grantWalletAuthorization(input: {
  ghUserId: string
  piAppUid: string
  source?: "user_explicit"
}): Promise<{ ok: boolean; error?: string; authorizationId?: string; piAppUid?: string; diagnosticCode?: string; httpStatus?: number }> {
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
  if (!result.ok) return { ok: false, error: result.error, diagnosticCode: result.diagnosticCode, httpStatus: result.httpStatus }
  if (result.value.ok !== true) return { ok: false, error: String(result.value.error || "GRANT_FAILED") }
  return {
    ok: true,
    authorizationId: typeof result.value.authorizationId === "string" ? result.value.authorizationId : undefined,
    piAppUid: typeof result.value.piAppUid === "string" ? result.value.piAppUid : undefined,
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
  if (!result.ok) return { ok: false, error: result.error }
  return {
    ok: result.value.ok === true,
    revoked: result.value.revoked === true,
    error: typeof result.value.error === "string" ? result.value.error : undefined,
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
  if (!result.ok) return { ok: false, error: result.error }
  if (result.value.ok !== true) return { ok: false, error: String(result.value.error || "WALLET_AUTHORIZATION_REQUIRED") }
  return { ok: true, authorizationId: typeof result.value.authorizationId === "string" ? result.value.authorizationId : undefined }
}
