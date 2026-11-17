/**
 * Field Desk access — public browser gate with scoped passwords.
 *
 * Security model:
 * - Up to 10 shared access codes (env). Codes never become GH sessions.
 * - Successful unlock issues a short-lived HMAC field token (HttpOnly cookie).
 * - Token authorizes ONLY /api/field/* routes. No economy, wallet, or user PII APIs.
 * - Codes are compared as SHA-256 digests with timing-safe equality.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"

export const FIELD_COOKIE = "gh_field_session"
export const FIELD_TOKEN_TTL_SEC = 12 * 60 * 60 // 12 hours
export const FIELD_MAX_CODES = 10

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function fieldSecret(): string | null {
  // Field sessions use a dedicated secret. Never silently reuse auth/JWT secrets.
  const s = process.env.GHC_FIELD_SESSION_SECRET?.trim() || ""
  return s.length >= 32 ? s : null
}

/** Load up to 10 access-code digests from env. */
export function loadFieldCodeDigests(): string[] {
  const hashed = String(process.env.GHC_FIELD_ACCESS_CODE_HASHES || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[a-f0-9]{64}$/.test(s))
  if (hashed.length) return hashed.slice(0, FIELD_MAX_CODES)

  // Dev/ops convenience: plaintext codes hashed at runtime (still compared as digests).
  const plain = String(process.env.GHC_FIELD_ACCESS_CODES || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length >= 4 && s.length <= 128)
  return plain.slice(0, FIELD_MAX_CODES).map(sha256Hex)
}

export function fieldAccessConfigured(): boolean {
  return loadFieldCodeDigests().length > 0 && Boolean(fieldSecret())
}

export function verifyFieldAccessCode(code: string): boolean {
  const digests = loadFieldCodeDigests()
  if (!digests.length) return false
  const supplied = String(code || "").trim()
  if (supplied.length < 4 || supplied.length > 128) return false
  const suppliedDigest = Buffer.from(sha256Hex(supplied), "hex")
  for (const expectedHex of digests) {
    const expected = Buffer.from(expectedHex, "hex")
    if (expected.length === suppliedDigest.length && timingSafeEqual(expected, suppliedDigest)) {
      return true
    }
  }
  return false
}

type FieldTokenPayload = {
  v: 1
  iat: number
  exp: number
  jti: string
  /** Non-identifying agent label chosen by the user (optional, sanitized). */
  label?: string
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64")
}

export function mintFieldToken(label?: string): string | null {
  const secret = fieldSecret()
  if (!secret) return null
  const now = Math.floor(Date.now() / 1000)
  const payload: FieldTokenPayload = {
    v: 1,
    iat: now,
    exp: now + FIELD_TOKEN_TTL_SEC,
    jti: randomBytes(16).toString("hex"),
  }
  if (label) {
    const clean = label.replace(/[^\w\s\-.]/g, "").trim().slice(0, 40)
    if (clean) payload.label = clean
  }
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"))
  const sig = createHmac("sha256", secret).update(body).digest()
  return `${body}.${b64url(sig)}`
}

export function verifyFieldToken(token: string): FieldTokenPayload | null {
  const secret = fieldSecret()
  if (!secret || !token || token.length > 512) return null
  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [body, sig] = parts
  let expected: Buffer
  let supplied: Buffer
  try {
    expected = createHmac("sha256", secret).update(body).digest()
    supplied = fromB64url(sig)
  } catch {
    return null
  }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null
  try {
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as FieldTokenPayload
    if (payload.v !== 1) return null
    const now = Math.floor(Date.now() / 1000)
    if (typeof payload.exp !== "number" || payload.exp <= now) return null
    if (typeof payload.iat !== "number" || payload.iat > now + 30) return null
    if (typeof payload.jti !== "string" || payload.jti.length < 16) return null
    return payload
  } catch {
    return null
  }
}

export function fieldTokenFromRequest(request: Request): FieldTokenPayload | null {
  const cookie = request.headers.get("cookie") || ""
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${FIELD_COOKIE}=([^;]+)`))
  const raw = match?.[1] ? decodeURIComponent(match[1]) : ""
  // Also accept Authorization: Field <token> for agent/automation clients
  const auth = request.headers.get("authorization") || ""
  const bearer = auth.match(/^Field\s+(\S+)/i)?.[1] || ""
  return verifyFieldToken(raw || bearer)
}

export function buildFieldSessionCookie(token: string): string {
  const secure =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1" ? "; Secure" : ""
  return `${FIELD_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${FIELD_TOKEN_TTL_SEC}; HttpOnly; SameSite=Lax${secure}`
}

export function clearFieldSessionCookie(): string {
  const secure =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1" ? "; Secure" : ""
  return `${FIELD_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`
}
