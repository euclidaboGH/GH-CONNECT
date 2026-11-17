// Authentication rate limiting to prevent brute force attacks

const RATE_LIMIT_KEY_PREFIX = 'gh-auth-attempt-'
const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes
const ATTEMPT_WINDOW_MS = 60 * 1000 // 1 minute

interface AttemptRecord {
  count: number
  firstAttemptTime: number
  lockedUntil?: number
}

/**
 * Get the rate limit key for an identifier (email, username, IP)
 */
function getRateLimitKey(identifier: string): string {
  return `${RATE_LIMIT_KEY_PREFIX}${identifier}`
}

/**
 * Check if an identifier is currently rate limited
 */
export function isRateLimited(identifier: string): { limited: boolean; remainingTime?: number } {
  const key = getRateLimitKey(identifier)

  try {
    const stored = localStorage.getItem(key)
    if (!stored) {
      return { limited: false }
    }

    const record: AttemptRecord = JSON.parse(stored)

    // Check if locked out
    if (record.lockedUntil && Date.now() < record.lockedUntil) {
      const remainingTime = record.lockedUntil - Date.now()
      return { limited: true, remainingTime }
    }

    // Check if attempt window has expired
    if (Date.now() - record.firstAttemptTime > ATTEMPT_WINDOW_MS) {
      localStorage.removeItem(key)
      return { limited: false }
    }

    // Check if max attempts exceeded
    if (record.count >= MAX_ATTEMPTS) {
      return { limited: true, remainingTime: LOCKOUT_DURATION_MS }
    }

    return { limited: false }
  } catch {
    return { limited: false }
  }
}

/**
 * Record an authentication attempt
 */
export function recordAuthAttempt(identifier: string, success: boolean): void {
  const key = getRateLimitKey(identifier)

  try {
    const stored = localStorage.getItem(key)
    let record: AttemptRecord

    if (stored) {
      record = JSON.parse(stored)

      // Reset if attempt window has expired
      if (Date.now() - record.firstAttemptTime > ATTEMPT_WINDOW_MS) {
        record = { count: 0, firstAttemptTime: Date.now() }
      }
    } else {
      record = { count: 0, firstAttemptTime: Date.now() }
    }

    // Increment attempt count only for failures
    if (!success) {
      record.count++

      // Lock out if max attempts exceeded
      if (record.count >= MAX_ATTEMPTS) {
        record.lockedUntil = Date.now() + LOCKOUT_DURATION_MS
      }
    } else {
      // Clear on successful auth
      localStorage.removeItem(key)
      return
    }

    localStorage.setItem(key, JSON.stringify(record))
  } catch (error) {
    console.warn('[v0] Rate limit storage failed:', error)
  }
}

/**
 * Get remaining attempts before lockout
 */
export function getRemainingAttempts(identifier: string): number {
  const key = getRateLimitKey(identifier)

  try {
    const stored = localStorage.getItem(key)
    if (!stored) {
      return MAX_ATTEMPTS
    }

    const record: AttemptRecord = JSON.parse(stored)

    // Reset if window expired
    if (Date.now() - record.firstAttemptTime > ATTEMPT_WINDOW_MS) {
      localStorage.removeItem(key)
      return MAX_ATTEMPTS
    }

    return Math.max(0, MAX_ATTEMPTS - record.count)
  } catch {
    return MAX_ATTEMPTS
  }
}

/**
 * Clear rate limit for an identifier (admin function)
 */
export function clearRateLimit(identifier: string): void {
  const key = getRateLimitKey(identifier)

  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore errors
  }
}

/**
 * Get detailed rate limit status
 */
export function getRateLimitStatus(identifier: string): {
  isLimited: boolean
  attempts: number
  remainingAttempts: number
  remainingTime?: number
  lockoutUntil?: number
} {
  const key = getRateLimitKey(identifier)

  try {
    const stored = localStorage.getItem(key)
    if (!stored) {
      return {
        isLimited: false,
        attempts: 0,
        remainingAttempts: MAX_ATTEMPTS,
      }
    }

    const record: AttemptRecord = JSON.parse(stored)

    // Reset if window expired
    if (Date.now() - record.firstAttemptTime > ATTEMPT_WINDOW_MS) {
      localStorage.removeItem(key)
      return {
        isLimited: false,
        attempts: 0,
        remainingAttempts: MAX_ATTEMPTS,
      }
    }

    const isLocked = record.lockedUntil && Date.now() < record.lockedUntil
    const remainingTime = isLocked ? record.lockedUntil! - Date.now() : undefined

    return {
      isLimited: isLocked || record.count >= MAX_ATTEMPTS,
      attempts: record.count,
      remainingAttempts: Math.max(0, MAX_ATTEMPTS - record.count),
      remainingTime,
      lockoutUntil: record.lockedUntil,
    }
  } catch {
    return {
      isLimited: false,
      attempts: 0,
      remainingAttempts: MAX_ATTEMPTS,
    }
  }
}
