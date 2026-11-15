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
  piWalletAddress?: string | null
  walletAddressSource?: "platform_api" | "pi_sdk_scope" | "provider_payment" | null
  walletAddressVerifiedAt?: string | null
  consentedAt?: string | null
  lastVerifiedAt?: string | null
  uidMatchesAuthorization?: boolean
  authorizationReason?: string | null
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
  const address = typeof value.piWalletAddress === "string" ? value.piWalletAddress.trim().toUpperCase() : ""
  const source = value.walletAddressSource === "platform_api" || value.walletAddressSource === "provider_payment" ? value.walletAddressSource : null
  const verifiedAt = typeof value.walletAddressVerifiedAt === "string" && value.walletAddressVerifiedAt ? value.walletAddressVerifiedAt : null
  const trustedAddress = /^G[A-Z2-7]{55}$/.test(address) && source === "platform_api" && Boolean(verifiedAt)
  const active = value.authorizationActive === true && uidMatches && trustedAddress
  const authorizationReason = active
    ? null
    : !value.hasMapping
      ? "IDENTITY_MAPPING_REQUIRED"
      : !uidMatches
        ? "IDENTITY_MISMATCH"
        : !address
          ? "PI_WALLET_ADDRESS_REQUIRED"
          : "PI_WALLET_ADDRESS_UNVERIFIED"
  return {
    ...value,
    ok: value.ok === true,
    authorizationActive: active,
    authorizationReason,
    piWalletAddress: uidMatches && trustedAddress ? address : null,
    walletAddressSource: uidMatches && trustedAddress ? source : null,
    walletAddressVerifiedAt: uidMatches && trustedAddress ? verifiedAt : null,
    uidMatchesAuthorization: uidMatches,
  }
}

export async function grantWalletAuthorization(input: {
  ghUserId: string
  piAppUid: string
  source?: "user_explicit"
  piWalletAddress: string
  walletAddressSource: "platform_api"
}): Promise<{ ok: boolean; error?: string; authorizationId?: string; piAppUid?: string; piWalletAddress?: string; walletAddressSource?: string; diagnosticCode?: string; httpStatus?: number }> {
  const userId = String(input.ghUserId || "").trim()
  const piUid = String(input.piAppUid || "").trim()
  const address = String(input.piWalletAddress || "").trim().toUpperCase()
  if (!userId || userId.length > 160 || !piUid || piUid.length > 160) return { ok: false, error: "INVALID_INPUT" }
  if (!/^G[A-Z2-7]{55}$/.test(address) || input.walletAddressSource !== "platform_api") return { ok: false, error: "PI_WALLET_ADDRESS_UNVERIFIED" }
  const result = await rpc<{
    ok?: boolean
    error?: string
    authorizationId?: string
    piAppUid?: string
    piWalletAddress?: string
    walletAddressSource?: string
  }>("gh_pi_wallet_authorization_grant", {
    p_user_id: userId,
    p_pi_app_uid: piUid,
    p_source: input.source || "user_explicit",
    p_pi_wallet_address: address,
    p_wallet_address_source: input.walletAddressSource,
  })
  if (!result.ok) return { ok: false, error: result.error, diagnosticCode: result.diagnosticCode, httpStatus: result.httpStatus }
  if (result.value.ok !== true) {
    const error = typeof result.value.error === "string" && /^[A-Z0-9_]{2,80}$/.test(result.value.error)
      ? result.value.error
      : "GRANT_FAILED"
    return { ok: false, error }
  }
  if (
    result.value.piAppUid !== piUid ||
    String(result.value.piWalletAddress || "").trim().toUpperCase() !== address ||
    result.value.walletAddressSource !== "platform_api"
  ) return { ok: false, error: "GRANT_RESPONSE_MISMATCH" }
  return {
    ok: true,
    authorizationId: typeof result.value.authorizationId === "string" ? result.value.authorizationId : undefined,
    piAppUid: typeof result.value.piAppUid === "string" ? result.value.piAppUid : undefined,
    piWalletAddress: address,
    walletAddressSource: typeof result.value.walletAddressSource === "string" ? result.value.walletAddressSource : undefined,
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

/** Gate A2U payouts: mapped UID + explicit consent + bound Pi wallet address. */
export async function assertPayoutWalletAuthorization(input: {
  ghUserId: string
  recipientUid: string
}): Promise<{ ok: boolean; error?: string; authorizationId?: string; piWalletAddress?: string; walletAddressSource?: string; walletAddressVerifiedAt?: string | null }> {
  const result = await rpc<{
    ok?: boolean
    error?: string
    authorizationId?: string
    piWalletAddress?: string
    walletAddressSource?: string
    walletAddressVerifiedAt?: string | null
  }>("gh_pi_wallet_authorization_assert_payout", {
    p_user_id: String(input.ghUserId || "").trim(),
    p_recipient_uid: String(input.recipientUid || "").trim(),
  })
  if (!result.ok) return { ok: false, error: result.error }
  if (result.value.ok !== true) return { ok: false, error: String(result.value.error || "WALLET_AUTHORIZATION_REQUIRED") }
  const address = String(result.value.piWalletAddress || "").trim().toUpperCase()
  const verifiedAt = typeof result.value.walletAddressVerifiedAt === "string" ? result.value.walletAddressVerifiedAt : null
  if (!/^G[A-Z2-7]{55}$/.test(address) || !(result.value.walletAddressSource === "platform_api" || result.value.walletAddressSource === "provider_payment") || !verifiedAt) {
    return { ok: false, error: "PI_WALLET_ADDRESS_UNVERIFIED" }
  }
  return {
    ok: true,
    authorizationId: typeof result.value.authorizationId === "string" ? result.value.authorizationId : undefined,
    piWalletAddress: address,
    walletAddressSource: typeof result.value.walletAddressSource === "string" ? result.value.walletAddressSource : undefined,
    walletAddressVerifiedAt: typeof result.value.walletAddressVerifiedAt === "string" ? result.value.walletAddressVerifiedAt : null,
  }
}
