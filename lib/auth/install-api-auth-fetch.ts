/**
 * Browser-only. Adds `Authorization: Bearer <Pi token>` to same-origin /api/* requests that
 * do not already carry one, so the server can still authenticate the user when the
 * `gh_session` cookie is blocked (Pi Browser / App Studio cross-site iframe).
 *
 * - Cookie auth stays first on the server; this is only a fallback.
 * - Never touches cross-origin requests or /api/auth/* (those carry the token in the body).
 * - Skips dev "user:" tokens (rejected in production anyway).
 */
import { IdentityService } from "@/lib/identity/identity-service"
import { regionalHeaders } from "@/lib/regional-context"

declare global {
  interface Window {
    __ghApiAuthFetchInstalled?: boolean
  }
}

function resolveUrl(input: RequestInfo | URL): URL | null {
  try {
    if (typeof input === "string") return new URL(input, window.location.origin)
    if (input instanceof URL) return input
    return new URL(input.url, window.location.origin)
  } catch {
    return null
  }
}

function bearerHeader(): string | null {
  try {
    const value = IdentityService.getAuthHeaders().Authorization
    if (!value || /^Bearer\s+user:/i.test(value)) return null
    return value
  } catch {
    return null
  }
}

if (typeof window !== "undefined" && !window.__ghApiAuthFetchInstalled) {
  window.__ghApiAuthFetchInstalled = true
  const nativeFetch = window.fetch.bind(window)

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = resolveUrl(input)
      if (
        url &&
        url.origin === window.location.origin &&
        url.pathname.startsWith("/api/") &&
        !url.pathname.startsWith("/api/auth/")
      ) {
        const auth = bearerHeader()
        const headers = new Headers(
          init?.headers ?? (typeof input === "object" && "headers" in input ? (input as Request).headers : undefined)
        )
        if (auth && !headers.has("Authorization")) headers.set("Authorization", auth)
        // Locale/time-zone are safe regional display hints. Precise location is never attached globally.
        const regional = regionalHeaders(null)
        if (!headers.has("X-GH-Locale")) headers.set("X-GH-Locale", regional["X-GH-Locale"])
        if (!headers.has("X-GH-Timezone")) headers.set("X-GH-Timezone", regional["X-GH-Timezone"])
        if (typeof input === "object" && !(input instanceof URL)) {
          return nativeFetch(new Request(input as Request, { ...init, headers }))
        }
        return nativeFetch(input, { ...init, headers })
      }
    } catch {
      /* fall through to the untouched request */
    }
    return nativeFetch(input, init)
  }
}

export {}
