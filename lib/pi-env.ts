/**
 * Environment-aware Pi configuration for GH Connect.
 *
 * LOCAL:     http://localhost:3000          → sandbox: true
 * PREVIEW:   Vercel preview deployments     → sandbox: true
 * PRODUCTION: configured production host    → sandbox: false (unless overridden)
 *
 * Never hard-code deployment URLs into business logic; derive from runtime origin
 * and explicit env flags.
 */

/** Public OAuth Client ID (Developer Portal → Pi Sign-in). Not a secret. */
export function getPiClientId(): string {
  return (process.env.NEXT_PUBLIC_PI_CLIENT_ID || "").trim()
}

/**
 * Resolve whether Pi SDK / payments should use sandbox (Testnet).
 *
 * Priority:
 * 1. Explicit NEXT_PUBLIC_PI_SANDBOX=true|false
 * 2. Vercel preview → true
 * 3. localhost → true
 * 4. Known production host → false
 * 5. Default false in production NODE_ENV, true otherwise
 */
export function resolvePiSandbox(opts?: {
  hostname?: string | null
  vercelEnv?: string | null
}): boolean {
  const explicit = process.env.NEXT_PUBLIC_PI_SANDBOX
  if (explicit === "true") return true
  if (explicit === "false") return false

  const vercelEnv =
    opts?.vercelEnv ??
    process.env.NEXT_PUBLIC_VERCEL_ENV ??
    process.env.VERCEL_ENV ??
    ""
  if (vercelEnv === "preview" || vercelEnv === "development") return true

  const host = (opts?.hostname || "").toLowerCase()
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
    return true
  }

  // Production deployment host from env (optional explicit list)
  const prodHosts = (process.env.NEXT_PUBLIC_PI_PRODUCTION_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
  if (host && prodHosts.includes(host)) return false

  // Default: production builds use mainnet unless sandbox was set
  if (process.env.NODE_ENV === "production" && vercelEnv === "production") {
    return false
  }

  return process.env.NODE_ENV !== "production"
}

/**
 * Canonical app origin for the current deployment.
 * Prefer NEXT_PUBLIC_APP_URL when set; otherwise derive from request/window.
 */
export function resolveAppOrigin(opts?: {
  requestOrigin?: string | null
  windowOrigin?: string | null
}): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "")
  if (configured) return configured

  const fromRequest = (opts?.requestOrigin || "").trim().replace(/\/$/, "")
  if (fromRequest) return fromRequest

  const fromWindow = (opts?.windowOrigin || "").trim().replace(/\/$/, "")
  if (fromWindow) return fromWindow

  // Safe local default for SSR without window
  return "http://localhost:3000"
}

/** OAuth redirect URI for Pi Sign-in (must match Developer Portal registration). */
export function getPiSignInRedirectUri(origin?: string | null): string {
  const base = resolveAppOrigin({
    windowOrigin: origin,
    requestOrigin: origin,
  })
  return `${base}/signin/callback`
}

export const PI_OAUTH_AUTHORIZE_URL = "https://accounts.pinet.com/oauth/authorize"
export const PI_OAUTH_STATE_KEY = "pi_oauth_state"
export const PI_OAUTH_SCOPE = "username"
