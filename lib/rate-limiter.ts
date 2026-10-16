// Rate limiting and anti-spam utilities

interface RateLimitEntry {
  count: number
  resetTime: number
}

class RateLimiter {
  private limits = new Map<string, RateLimitEntry>()
  private readonly maxAttempts: number
  private readonly windowMs: number

  constructor(maxAttempts = 10, windowMs = 60000) {
    this.maxAttempts = maxAttempts
    this.windowMs = windowMs
  }

  isAllowed(key: string): boolean {
    const now = Date.now()
    const entry = this.limits.get(key)

    if (!entry || now > entry.resetTime) {
      this.limits.set(key, { count: 1, resetTime: now + this.windowMs })
      return true
    }

    if (entry.count < this.maxAttempts) {
      entry.count++
      return true
    }

    return false
  }

  getRemainingTime(key: string): number {
    const entry = this.limits.get(key)
    if (!entry) return 0
    return Math.max(0, entry.resetTime - Date.now())
  }

  reset(key: string): void {
    this.limits.delete(key)
  }

  resetAll(): void {
    this.limits.clear()
  }
}

// Pre-configured limiters
export const messageLimiter = new RateLimiter(30, 60000) // 30 messages per minute
export const swipeLimiter = new RateLimiter(100, 60000) // 100 swipes per minute
export const postLimiter = new RateLimiter(5, 300000) // 5 posts per 5 minutes
export const reportLimiter = new RateLimiter(20, 86400000) // 20 reports per day

// Spam detection
export const spamDetection = {
  detectSpamText: (text: string): boolean => {
    // Check for excessive repeated characters
    if (/(.)\1{4,}/.test(text)) return true

    // Check for excessive uppercase
    const upperCount = (text.match(/[A-Z]/g) || []).length
    if (upperCount / text.length > 0.7) return true

    // Check for URL spam
    const urlCount = (text.match(/https?:\/\//g) || []).length
    if (urlCount > 3) return true

    // Check for emojis (limit to 5)
    const emojiRegex = /(\u00d8[\u0080-\u00ff]|[\u00d8-\u00dc][\u0080-\u00ff]|[\u00d8][\u0080-\u009f])/g
    if ((text.match(emojiRegex) || []).length > 5) return true

    return false
  },

  // Check if profile update looks spammy
  isSpammyProfile: (bio: string, name: string): boolean => {
    if (spamDetection.detectSpamText(bio)) return true
    if ((bio.match(/https?:\/\//g) || []).length > 2) return true
    if (name.length < 2) return true
    return false
  },
}
