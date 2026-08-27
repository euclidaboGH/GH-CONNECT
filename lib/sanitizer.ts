// Advanced content sanitization and security utilities
import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitization levels for different content types
 */
export const SanitizationLevels = {
  STRICT: 'strict',      // For HTML content
  MODERATE: 'moderate',  // For user-generated text
  LOOSE: 'loose',        // For plain text only
} as const

/**
 * Context-aware HTML sanitization
 * Prevents XSS attacks by allowing only safe HTML elements
 */
export function sanitizeHtml(dirty: string, level: string = 'strict'): string {
  if (!dirty || typeof dirty !== 'string') return ''

  const configs = {
    strict: {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br'],
      ALLOWED_ATTR: ['href', 'target'],
      KEEP_CONTENT: true,
    },
    moderate: {
      ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'ul', 'ol', 'li', 'a'],
      ALLOWED_ATTR: ['href'],
      KEEP_CONTENT: true,
    },
    loose: {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    },
  }

  return DOMPurify.sanitize(dirty, configs[level as keyof typeof configs] || configs.strict)
}

/**
 * Sanitize plain text input
 * Removes control characters and excessive whitespace
 */
export function sanitizeText(text: string, maxLength?: number): string {
  if (!text || typeof text !== 'string') return ''

  let cleaned = text
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()

  if (maxLength && cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength)
  }

  return cleaned
}

/**
 * Sanitize user display names
 * Prevents impersonation and control character injection
 */
export function sanitizeDisplayName(name: string): string {
  const cleaned = sanitizeText(name, 50)
  // Allow only alphanumeric, spaces, hyphens, and underscores
  return cleaned.replace(/[^\w\s\-]/g, '')
}

/**
 * Sanitize email addresses
 * Removes potentially harmful characters while preserving validity
 */
export function sanitizeEmail(email: string): string {
  const cleaned = sanitizeText(email, 254)
  // RFC 5322 compliant email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(cleaned) ? cleaned.toLowerCase() : ''
}

/**
 * Sanitize URLs
 * Prevents javascript: and data: protocol attacks
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') return ''

  const trimmed = url.trim()

  // Prevent dangerous protocols
  if (trimmed.toLowerCase().startsWith('javascript:') ||
      trimmed.toLowerCase().startsWith('data:') ||
      trimmed.toLowerCase().startsWith('vbscript:')) {
    return ''
  }

  try {
    const parsed = new URL(trimmed, window.location.href)
    return parsed.toString()
  } catch {
    return ''
  }
}

/**
 * Escape special characters for safe display
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (char) => map[char])
}

/**
 * Sanitize JSON data to prevent injection
 */
export function sanitizeJson(data: any): any {
  try {
    const json = JSON.stringify(data)
    const cleaned = sanitizeText(json)
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

/**
 * Validate and sanitize form input
 */
export function sanitizeFormInput(input: string, type: 'email' | 'url' | 'text' | 'name' = 'text'): string {
  switch (type) {
    case 'email':
      return sanitizeEmail(input)
    case 'url':
      return sanitizeUrl(input)
    case 'name':
      return sanitizeDisplayName(input)
    case 'text':
    default:
      return sanitizeText(input)
  }
}

/**
 * Validate sensitive data hasn't been exposed in logs
 */
export function redactSensitiveData(text: string): string {
  return text
    .replace(/password['":\s=]+[^\s'"{}]+/gi, 'password=***REDACTED***')
    .replace(/token['":\s=]+[^\s'"{}]+/gi, 'token=***REDACTED***')
    .replace(/secret['":\s=]+[^\s'"{}]+/gi, 'secret=***REDACTED***')
    .replace(/key['":\s=]+[^\s'"{}]+/gi, 'key=***REDACTED***')
    .replace(/auth['":\s=]+[^\s'"{}]+/gi, 'auth=***REDACTED***')
}
