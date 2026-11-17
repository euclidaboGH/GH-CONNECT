/**
 * CSRF protection — Phase 2 cookie-based double-submit.
 *
 * Primary defense remains middleware same-origin + sec-fetch-site checks
 * (see middleware.ts and scripts/check-api-csrf-contract.mjs).
 *
 * This module provides a secondary double-submit token:
 * - Token is stored in a non-HttpOnly cookie readable by JS for the header value
 *   (double-submit pattern). It is NOT stored in localStorage.
 * - Sensitive mutations should send header X-CSRF-Token matching the cookie.
 * - Auth session tokens themselves must never live in localStorage; GH session
 *   uses HttpOnly cookies (session-store).
 */

const CSRF_COOKIE = "gh_csrf"
const CSRF_HEADER_NAME = "X-CSRF-Token"
const TOKEN_BYTES = 32

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

function generateRandomToken(): string {
  const array = new Uint8Array(TOKEN_BYTES)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(array)
  } else {
    for (let i = 0; i < array.length; i++) array[i] = Math.floor(Math.random() * 256)
  }
  return bytesToHex(array)
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const parts = document.cookie.split(";").map((p) => p.trim())
  for (const part of parts) {
    if (part.startsWith(name + "=")) {
      return decodeURIComponent(part.slice(name.length + 1))
    }
  }
  return null
}

function writeCookie(name: string, value: string, maxAgeSec: number): void {
  if (typeof document === "undefined") return
  const secure =
    typeof window !== "undefined" && window.location?.protocol === "https:"
      ? "; Secure"
      : ""
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Strict${secure}`
}

function clearCookie(name: string): void {
  if (typeof document === "undefined") return
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Strict`
}

/** Ensure a CSRF cookie exists and return its value. Does not use localStorage. */
export function initializeCsrfProtection(): string {
  const existing = readCookie(CSRF_COOKIE)
  if (existing && existing.length >= 32) return existing
  const token = generateRandomToken()
  writeCookie(CSRF_COOKIE, token, 24 * 60 * 60)
  return token
}

/** Current CSRF token (cookie-backed). Creates one if missing. */
export function getCsrfToken(): string {
  const existing = readCookie(CSRF_COOKIE)
  if (existing && existing.length >= 32) return existing
  return initializeCsrfProtection()
}

/**
 * Client-side sanity check only. Server must not rely on this alone;
 * middleware origin / sec-fetch-site is authoritative for browser mutations.
 */
export function verifyCsrfToken(token: string): boolean {
  if (typeof token !== "string" || token.length < 32) return false
  const cookie = readCookie(CSRF_COOKIE)
  return Boolean(cookie && cookie === token)
}

/** Header map for fetch/XHR. */
export function getCsrfHeader(): Record<string, string> {
  return {
    [CSRF_HEADER_NAME]: getCsrfToken(),
  }
}

/** Clear CSRF cookie (e.g. on logout). */
export function clearCsrfToken(): void {
  clearCookie(CSRF_COOKIE)
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("gh-csrf-token")
    }
  } catch {
    // ignore legacy cleanup errors
  }
}

/** Rotate token after sensitive operations. */
export function refreshCsrfToken(): string {
  clearCsrfToken()
  return initializeCsrfProtection()
}

export const CSRF_HEADER = CSRF_HEADER_NAME
export const CSRF_COOKIE_NAME = CSRF_COOKIE
