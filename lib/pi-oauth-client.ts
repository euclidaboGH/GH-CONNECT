/**
 * Client-side Pi Sign-in (OAuth 2.0 implicit flow).
 * Official docs: https://github.com/pi-apps/pi-platform-docs/blob/master/pi-sign-in.md
 *
 * - No client_secret
 * - Token returned in URL fragment at /signin/callback
 * - Server verifies via POST /api/auth/pi → existing gh_session
 */

import {
  getPiClientId,
  getPiSignInRedirectUri,
  PI_OAUTH_AUTHORIZE_URL,
  PI_OAUTH_SCOPE,
  PI_OAUTH_STATE_KEY,
} from "@/lib/pi-env"

function randomState(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(32)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Start Pi Sign-in: store CSRF state, redirect to accounts.pinet.com.
 * Prefer Pi.signIn when the SDK is available; otherwise plain OAuth redirect.
 */
export function startPiSignIn(): { ok: true } | { ok: false; error: string } {
  if (typeof window === "undefined") {
    return { ok: false, error: "Sign-in must run in the browser" }
  }

  const clientId = getPiClientId()
  if (!clientId) {
    return {
      ok: false,
      error:
        "NEXT_PUBLIC_PI_CLIENT_ID is not configured. Add your Pi Sign-in Client ID in environment variables.",
    }
  }

  const state = randomState()
  try {
    sessionStorage.setItem(PI_OAUTH_STATE_KEY, state)
  } catch {
    return { ok: false, error: "Could not store OAuth state (sessionStorage blocked)" }
  }

  const redirectUri = getPiSignInRedirectUri(window.location.origin)

  // Prefer official SDK helper when present
  try {
    const Pi = (window as unknown as {
      Pi?: {
        signIn?: (opts: {
          clientId: string
          redirectUri: string
          scopes?: string[]
          state?: string
        }) => void
      }
    }).Pi
    if (Pi && typeof Pi.signIn === "function") {
      Pi.signIn({
        clientId,
        redirectUri,
        scopes: [PI_OAUTH_SCOPE],
        state,
      })
      return { ok: true }
    }
  } catch {
    /* fall through to plain OAuth */
  }

  const url = new URL(PI_OAUTH_AUTHORIZE_URL)
  url.searchParams.set("response_type", "token")
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("scope", PI_OAUTH_SCOPE)
  url.searchParams.set("state", state)

  window.location.assign(url.toString())
  return { ok: true }
}

export type PiOAuthCallbackResult =
  | { ok: true; accessToken: string }
  | { ok: false; error: string; code: string }

/**
 * Parse OAuth implicit callback from location.hash and validate state.
 * Clears stored state and strips the fragment from the URL.
 */
export function consumePiOAuthCallback(): PiOAuthCallbackResult {
  if (typeof window === "undefined") {
    return { ok: false, error: "Not in browser", code: "NO_WINDOW" }
  }

  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""))
  let expected: string | null = null
  try {
    expected = sessionStorage.getItem(PI_OAUTH_STATE_KEY)
    sessionStorage.removeItem(PI_OAUTH_STATE_KEY)
  } catch {
    expected = null
  }

  // Strip token from address bar immediately
  try {
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`
    )
  } catch {
    /* */
  }

  const returnedState = params.get("state")
  if (!expected || !returnedState || returnedState !== expected) {
    return {
      ok: false,
      error: "OAuth state mismatch. Possible CSRF — please try Sign in with Pi again.",
      code: "STATE_MISMATCH",
    }
  }

  const err = params.get("error")
  if (err) {
    const map: Record<string, string> = {
      access_denied: "You declined Pi authorization.",
      expired: "Sign-in request expired. Please try again.",
      cancelled: "Sign-in was cancelled.",
      server_error: "Pi authorization server error. Please try again.",
    }
    return {
      ok: false,
      error: map[err] || `Pi Sign-in failed: ${err}`,
      code: err,
    }
  }

  const accessToken = params.get("access_token")
  if (!accessToken) {
    return {
      ok: false,
      error: "No access token returned from Pi.",
      code: "MISSING_TOKEN",
    }
  }

  return { ok: true, accessToken }
}
