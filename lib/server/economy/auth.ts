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
    const header = JSON.parse(base64UrlDecode(h).toString("utf8")) as { alg?: string }
    if (!header.alg || header.alg === "none" || header.alg !== "HS256") return null
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
    }
    if (payload.exp && payload.exp * 1000 < Date.now()) return null
    const sub = payload.sub || payload.user_id || payload.userId
    if (typeof sub !== "string" || !sub) return null
    return { sub, username: payload.username }
  } catch {
    return null
  }
}

/**
 * Cryptographically verify a Pi access token by calling Pi Platform /v2/me.
 * Network failure → null (caller maps to AUTH_REQUIRED / SERVER_UNAVAILABLE as appropriate).
 */
export async function verifyPiAccessToken(
  accessToken: string
): Promise<{ uid: string; username?: string } | null> {
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
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      uid?: string
      user?: { uid?: string; username?: string }
      username?: string
    }
    const uid = data.uid || data.user?.uid
    if (typeof uid !== "string" || !uid) return null
    return { uid, username: data.username || data.user?.username }
  } catch {
    return null
  }
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

  // 4) Pi Platform token verification (network) — bootstrap / payments compatibility
  const piUser = await verifyPiAccessToken(token)
  if (piUser) {
    return {
      userId: piUser.uid,
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
