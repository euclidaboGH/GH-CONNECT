// CSRF protection and security token management

const CSRF_TOKEN_KEY = 'gh-csrf-token'
const CSRF_HEADER_NAME = 'X-CSRF-Token'
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

interface CsrfToken {
  value: string
  timestamp: number
  fingerprint: string
}

/**
 * Generate a cryptographically secure random token
 */
function generateRandomToken(length: number = 32): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate device fingerprint for additional security
 */
function generateFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset(),
    window.devicePixelRatio,
    screen.width,
    screen.height,
  ]

  const combined = components.join('|')
  const encoder = new TextEncoder()
  const data = encoder.encode(combined)

  // Simple hash function (in production, use crypto.subtle.digest)
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i]
    hash = hash & hash // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16)
}

/**
 * Initialize CSRF protection on app start
 */
export function initializeCsrfProtection(): string {
  const storedToken = localStorage.getItem(CSRF_TOKEN_KEY)

  // Check if existing token is still valid
  if (storedToken) {
    try {
      const token: CsrfToken = JSON.parse(storedToken)
      const isExpired = Date.now() - token.timestamp > TOKEN_EXPIRY_MS
      const fingerprintMatch = token.fingerprint === generateFingerprint()

      if (!isExpired && fingerprintMatch) {
        return token.value
      }
    } catch {
      // Token is invalid, generate new one
    }
  }

  // Generate new token
  const newToken: CsrfToken = {
    value: generateRandomToken(),
    timestamp: Date.now(),
    fingerprint: generateFingerprint(),
  }

  try {
    localStorage.setItem(CSRF_TOKEN_KEY, JSON.stringify(newToken))
  } catch {
    // Fallback if localStorage is unavailable
    console.warn('[v0] CSRF token storage unavailable')
  }

  return newToken.value
}

/**
 * Get current CSRF token
 */
export function getCsrfToken(): string {
  const storedToken = localStorage.getItem(CSRF_TOKEN_KEY)
  if (!storedToken) {
    return initializeCsrfProtection()
  }

  try {
    const token: CsrfToken = JSON.parse(storedToken)
    const isExpired = Date.now() - token.timestamp > TOKEN_EXPIRY_MS

    if (isExpired) {
      return initializeCsrfProtection()
    }

    return token.value
  } catch {
    return initializeCsrfProtection()
  }
}

/**
 * Verify CSRF token validity
 */
export function verifyCsrfToken(token: string): boolean {
  const storedToken = localStorage.getItem(CSRF_TOKEN_KEY)
  if (!storedToken) return false

  try {
    const parsed: CsrfToken = JSON.parse(storedToken)
    const isExpired = Date.now() - parsed.timestamp > TOKEN_EXPIRY_MS
    const fingerprintMatch = parsed.fingerprint === generateFingerprint()
    const tokenMatch = parsed.value === token

    return !isExpired && fingerprintMatch && tokenMatch
  } catch {
    return false
  }
}

/**
 * Get CSRF token for API headers
 */
export function getCsrfHeader(): Record<string, string> {
  return {
    [CSRF_HEADER_NAME]: getCsrfToken(),
  }
}

/**
 * Clear CSRF token (for logout)
 */
export function clearCsrfToken(): void {
  try {
    localStorage.removeItem(CSRF_TOKEN_KEY)
  } catch {
    // Ignore errors
  }
}

/**
 * Refresh CSRF token (for sensitive operations)
 */
export function refreshCsrfToken(): string {
  clearCsrfToken()
  return initializeCsrfProtection()
}
