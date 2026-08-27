/**
 * Server authentication for GHC money-moving routes.
 *
 * Production rules:
 * - Never trust an unsigned JWT payload alone.
 * - Prefer Pi Platform token verification (GET /v2/me with Bearer access token).
 * - Optionally verify first-party JWTs with GHC_AUTH_JWT_SECRET / SUPABASE_JWT_SECRET (HMAC).
 * - Dev-only Bearer user:<id> requires GHC_ALLOW_DEV_AUTH=1 and non-production.
 */

import { createHmac, timingSafeEqual } from "crypto"
import { readGhcServerEnv } from "./env"

export type ServerAuthContext = {
  userId: string
  username?: string
  source: "pi_platform" | "verified_jwt" | "dev_token"
  rawToken?: string
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
    // signature is base64url
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
      // avoid hanging API routes
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
 * Order: dev token (non-prod only) → HS256 JWT secret → Pi Platform /v2/me.
 * Unsigned JWT decode is never accepted as proof of identity.
 */
export async function resolveAuthenticatedUser(
  headers: Headers
): Promise<ServerAuthContext | null> {
  const env = readGhcServerEnv()
  const auth = headers.get("authorization") || headers.get("Authorization") || ""
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (!m) return null
  const token = m[1].trim()
  if (!token) return null

  // 1) Explicit dev token — never in production
  if (token.startsWith("user:")) {
    if (!env.allowDevAuth) return null
    const id = token.slice(5).trim()
    if (!id) return null
    return { userId: id, source: "dev_token", rawToken: token }
  }

  // 2) Verified HS256 JWT (requires secret in env)
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

  // 3) Pi Platform token verification (network)
  const piUser = await verifyPiAccessToken(token)
  if (piUser) {
    return {
      userId: piUser.uid,
      username: piUser.username,
      source: "pi_platform",
      rawToken: token,
    }
  }

  // Reject unsigned / unverified tokens
  return null
}

/** Sync shim for older call sites that cannot await — prefer async resolveAuthenticatedUser */
export function resolveAuthenticatedUserSync(_headers: Headers): never {
  throw new Error("Use async resolveAuthenticatedUser(); unsigned JWT decode is no longer supported")
}
