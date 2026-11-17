/**
 * Server authentication for GHC money-moving routes and GH CONNECT APIs.
 *
 * Production rules:
 * - Never trust an unsigned JWT payload alone.
 * - Prefer GH server session (HttpOnly cookie) after Pi bootstrap.
 * - Prefer Pi Platform token verification (GET /v2/me with Bearer access token) for bootstrap.
 * - Optionally verify first-party JWTs with GHC_AUTH_JWT_SECRET / SUPABASE_JWT_SECRET (HMAC).
 * - Dev-only Bearer user:<id> requires GHC_ALLOW_DEV_AUTH=1 and non-production.
 */

import { createHmac, timingSafeEqual } from "crypto"
import { readGhcServerEnv } from "./env"
import {
  extractSessionTokenFromCookie,
  validateSession,
} from "@/lib/server/identity/session-store"
import { getByPiAppUid } from "@/lib/server/identity/pi-identity-store"

export type ServerAuthContext = {
  userId: string
  username?: string
  source: "gh_session" | "pi_platform" | "verified_jwt" | "dev_token"
  rawToken?: string
  sessionId?: string
}

function base64UrlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4))
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad
  return Buffer.from(b64, "base64")
}

/**
 * Verify HS256 JWT with shared secret (Supabase-style or first-party).
 * Rejects alg=none and mismatched signatures.
 */
function verifyHs256Jwt(
  token: string,
  secret: string
): { sub: string; username?: string } | null {
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [h, p, s] = parts
  try {
    const header = JSON.parse(base64UrlDecode(h).toString("utf8")) as { alg?: string; typ?: string }
    if (!header.alg || header.alg === "none" || header.alg !== "HS256") return null
    // Phase 2: require typ to be a recognized JWT type (header preferred, payload fallback).
    const headerTyp = typeof header.typ === "string" ? header.typ.toUpperCase() : ""
    if (headerTyp && headerTyp !== "JWT" && headerTyp !== "AT+JWT") return null
    const expected = createHmac("sha256", secret)
      .update(`${h}.${p}`)
      .digest()
    let sig: Buffer
    try {
      sig = base64UrlDecode(s)
    } catch {
      return null
    }
    if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null
    const payload = JSON.parse(base64UrlDecode(p).toString("utf8")) as {
      sub?: string
      user_id?: string
      userId?: string
      username?: string
      exp?: number
      nbf?: number
      iat?: number
      iss?: string
      aud?: string | string[]
      typ?: string
    }
    const nowSeconds = Math.floor(Date.now() / 1000)
    // Authentication JWTs must be time-bounded. Missing/invalid exp used to
    // bypass expiration checks because zero/undefined were treated as absent.
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return null
    if (payload.exp <= nowSeconds) return null
    if (typeof payload.nbf === "number" && (!Number.isFinite(payload.nbf) || payload.nbf > nowSeconds + 30)) return null
    if (typeof payload.iat === "number" && (!Number.isFinite(payload.iat) || payload.iat > nowSeconds + 30)) return null
    // Phase 2: typ required (header or payload). Reject tokens with neither.
    const payloadTyp = typeof payload.typ === "string" ? payload.typ.toUpperCase() : ""
    const typ = headerTyp || payloadTyp
    if (typ !== "JWT" && typ !== "AT+JWT") return null
    // Phase 2: iss and aud are required when first-party JWT verification is enabled.
    // Configure GHC_AUTH_JWT_ISSUER and GHC_AUTH_JWT_AUDIENCE; missing config rejects the token.
    const expectedIssuer = process.env.GHC_AUTH_JWT_ISSUER?.trim()
    if (!expectedIssuer || payload.iss !== expectedIssuer) return null
    const expectedAudience = process.env.GHC_AUTH_JWT_AUDIENCE?.trim()
    if (!expectedAudience) return null
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
    if (!audiences.includes(expectedAudience)) return null
    const sub = payload.sub || payload.user_id || payload.userId
    if (typeof sub !== "string" || !sub.trim() || sub.length > 256) return null
    return { sub: sub.trim(), username: payload.username }
  } catch {
    return null
  }
}

/**
 * Result of the authoritative Pi Platform identity check.
 * Keep invalid credentials distinct from an upstream outage: a timeout, 429 or
 * 5xx from Pi must never be presented to the Pioneer as a bad/expired token.
 */
export type PiAccessTokenVerification =
  | { ok: true; user: { uid: string; username?: string; walletAddress?: string; scopes?: string[] } }
  | { ok: false; reason: "INVALID_TOKEN" | "PI_UNAVAILABLE" | "INVALID_PI_RESPONSE" }

/** Verify a Pi access token against the authoritative Platform GET /v2/me. */
export async function verifyPiAccessTokenDetailed(
  accessToken: string
): Promise<PiAccessTokenVerification> {
  const env = readGhcServerEnv()
  const url = `${env.piPlatformApiUrl}/v2/me`
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout?.(12_000),
      cache: "no-store",
    })
    if (res.status === 401 || res.status === 403) {
      return { ok: false, reason: "INVALID_TOKEN" }
    }
    if (res.status === 429 || res.status >= 500 || !res.ok) {
      return { ok: false, reason: "PI_UNAVAILABLE" }
    }
    let data: {
      uid?: string
      user?: { uid?: string; username?: string; wallet_address?: string; walletAddress?: string }
      username?: string
      wallet_address?: string
      walletAddress?: string
      credentials?: { scopes?: unknown }
    }
    try {
      data = await res.json()
    } catch {
      return { ok: false, reason: "INVALID_PI_RESPONSE" }
    }
    const uid = data.uid || data.user?.uid
    if (typeof uid !== "string" || !uid.trim()) {
      return { ok: false, reason: "INVALID_PI_RESPONSE" }
    }
    const walletAddress = data.wallet_address || data.walletAddress || data.user?.wallet_address || data.user?.walletAddress
    const scopes = Array.isArray(data.credentials?.scopes)
      ? data.credentials.scopes.filter((v): v is string => typeof v === "string").slice(0, 16)
      : undefined
    return {
      ok: true,
      user: {
        uid: uid.trim(),
        username: data.username || data.user?.username,
        ...(typeof walletAddress === "string" && walletAddress.trim() ? { walletAddress: walletAddress.trim().toUpperCase() } : {}),
        ...(scopes ? { scopes } : {}),
      },
    }
  } catch {
    return { ok: false, reason: "PI_UNAVAILABLE" }
  }
}

/** Backwards-compatible nullable verifier for existing callers. */
export async function verifyPiAccessToken(
  accessToken: string
): Promise<{ uid: string; username?: string; walletAddress?: string; scopes?: string[] } | null> {
  const result = await verifyPiAccessTokenDetailed(accessToken)
  return result.ok ? result.user : null
}

/**
 * Resolve authenticated user for server routes.
 * Order:
 *  1) GH server session cookie (preferred for ordinary API after Pi bootstrap)
 *  2) Dev token (non-prod only)
 *  3) HS256 JWT secret
 *  4) Pi Platform /v2/me Bearer
 *
 * Production hard rules:
 * - Bearer user:<id> is always rejected when isProduction is true
 * - GH sessions must be valid, unexpired, unrevoked (server-side)
 */
export async function resolveAuthenticatedUser(
  headersOrRequest: Headers | Request
): Promise<ServerAuthContext | null> {
  const headers =
    typeof Headers !== "undefined" && headersOrRequest instanceof Headers
      ? headersOrRequest
      : (headersOrRequest as Request).headers
  const env = readGhcServerEnv()

  // 1) GH server session (HttpOnly cookie) — preferred after bootstrap
  const sessionToken = extractSessionTokenFromCookie(headers)
  if (sessionToken) {
    const session = await validateSession(sessionToken, { touch: true })
    if (session) {
      return {
        userId: session.ghUserId,
        source: "gh_session",
        sessionId: session.id,
      }
    }
    // Invalid/expired cookie: fall through to other methods (e.g. Pi Bearer bootstrap)
  }

  const auth = headers.get("authorization") || headers.get("Authorization") || ""
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (!m) return null
  const token = m[1].trim()
  if (!token) return null

  // 2) Explicit dev token — never in production (double-gated)
  if (token.startsWith("user:")) {
    if (env.isProduction || !env.allowDevAuth) {
      if (env.isProduction) {
        console.error("[auth] REJECTED_DEV_TOKEN_IN_PRODUCTION")
      }
      return null
    }
    const id = token.slice(5).trim()
    if (!id) return null
    return { userId: id, source: "dev_token", rawToken: token }
  }

  // 3) Verified HS256 JWT (requires secret in env)
  if (env.authJwtSecret) {
    const verified = verifyHs256Jwt(token, env.authJwtSecret)
    if (verified) {
      return {
        userId: verified.sub,
        username: verified.username,
        source: "verified_jwt",
        rawToken: token,
      }
    }
  }

  // 4) Pi Platform token verification (network) — bootstrap / payments compatibility.
  // Map verified Pi app uid → canonical GH user id when mapping exists.
  // Never trust client-supplied uid; only Platform /v2/me result is used.
  const piUser = await verifyPiAccessToken(token)
  if (piUser?.uid) {
    let mapping: Awaited<ReturnType<typeof getByPiAppUid>> = null
    try {
      mapping = await getByPiAppUid(piUser.uid)
    } catch {
      // A verified Pi UID is not a canonical GreenHaven user ID. Production
      // must fail closed when its durable identity mapping cannot be resolved.
    }

    if (!mapping?.ghUserId) {
      if (env.isProduction) return null
      // Non-production compatibility only: legacy local/test flows may not yet
      // have run the Pi identity bootstrap. This fallback is never production auth.
      return {
        userId: piUser.uid,
        username: piUser.username,
        source: "pi_platform",
        rawToken: token,
      }
    }

    return {
      userId: mapping.ghUserId,
      username: piUser.username,
      source: "pi_platform",
      rawToken: token,
    }
  }

  return null
}

/** Sync shim for older call sites that cannot await — prefer async resolveAuthenticatedUser */
export function resolveAuthenticatedUserSync(_headers: Headers): never {
  throw new Error("Use async resolveAuthenticatedUser(); unsigned JWT decode is no longer supported")
}
