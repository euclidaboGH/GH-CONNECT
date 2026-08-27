// Data consistency checks and validation utilities

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate data integrity against schema
 */
export function validateDataIntegrity(data: unknown, schema: Record<string, any>): ValidationResult {
  const errors: string[] = []

  if (typeof data !== 'object' || data === null) {
    return {
      valid: false,
      errors: ['Data must be an object'],
    }
  }

  // Check required fields
  for (const [key, rules] of Object.entries(schema)) {
    const value = (data as Record<string, unknown>)[key]

    if (rules.required && (value === undefined || value === null)) {
      errors.push(`Missing required field: ${key}`)
    }

    if (value !== undefined && value !== null) {
      // Type validation
      if (rules.type && typeof value !== rules.type) {
        errors.push(`Field '${key}' has invalid type. Expected ${rules.type}, got ${typeof value}`)
      }

      // Min/max validation
      if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
        errors.push(`Field '${key}' is too short. Minimum length: ${rules.minLength}`)
      }

      if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
        errors.push(`Field '${key}' is too long. Maximum length: ${rules.maxLength}`)
      }

      // Enum validation
      if (rules.enum && Array.isArray(rules.enum) && !rules.enum.includes(value)) {
        errors.push(`Field '${key}' has invalid value. Must be one of: ${rules.enum.join(', ')}`)
      }

      // Pattern validation
      if (rules.pattern && typeof value === 'string' && !new RegExp(rules.pattern).test(value)) {
        errors.push(`Field '${key}' does not match required pattern`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Check for data corruption or tampering
 */
export function detectDataCorruption(data: unknown, expectedHash: string): boolean {
  const actualHash = hashData(data)
  return actualHash === expectedHash
}

/**
 * Simple hash function for data validation
 */
export function hashData(data: unknown): string {
  const json = JSON.stringify(data)
  let hash = 0

  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16)
}

/**
 * Verify data consistency across storage systems
 */
export function verifyDataConsistency(
  primaryData: unknown,
  backupData: unknown,
  tolerance: number = 0
): {
  consistent: boolean
  differences: string[]
} {
  const differences: string[] = []

  // Compare JSON stringified versions
  const primary = JSON.stringify(primaryData)
  const backup = JSON.stringify(backupData)

  if (primary !== backup) {
    // Calculate similarity
    const similarity = calculateStringSimilarity(primary, backup)

    if (similarity < 1 - tolerance) {
      differences.push(`Data mismatch: ${((1 - similarity) * 100).toFixed(2)}% different`)
    }
  }

  return {
    consistent: differences.length === 0,
    differences,
  }
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1

  if (longer.length === 0) return 1

  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = []

  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j
      } else if (j > 0) {
        let newValue = costs[j - 1]
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
        }
        costs[j - 1] = lastValue
        lastValue = newValue
      }
    }

    if (i > 0) {
      costs[s2.length] = lastValue
    }
  }

  return costs[s2.length]
}

/**
 * Create a backup of data with metadata
 */
export function createBackup<T>(data: T): {
  data: T
  timestamp: number
  hash: string
} {
  return {
    data,
    timestamp: Date.now(),
    hash: hashData(data),
  }
}

/**
 * Restore from backup with validation
 */
export function restoreFromBackup<T>(
  backup: any,
  validator?: (data: T) => boolean
): { success: boolean; data: T | null; error?: string } {
  try {
    if (!backup || !backup.data) {
      return {
        success: false,
        data: null,
        error: 'Invalid backup format',
      }
    }

    // Validate data if validator provided
    if (validator && !validator(backup.data)) {
      return {
        success: false,
        data: null,
        error: 'Backup data validation failed',
      }
    }

    // Verify hash
    const currentHash = hashData(backup.data)
    if (currentHash !== backup.hash) {
      console.warn('[v0] Backup hash mismatch - data may be corrupted')
    }

    return {
      success: true,
      data: backup.data,
    }
  } catch (error) {
    return {
      success: false,
      data: null,
      error: `Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Detect and fix data inconsistencies
 */
export function resolveDataConflict<T>(
  primaryData: T,
  backupData: T,
  strategy: 'primary' | 'backup' | 'merge' = 'primary'
): T {
  switch (strategy) {
    case 'backup':
      return backupData
    case 'merge':
      return mergeData(primaryData, backupData)
    case 'primary':
    default:
      return primaryData
  }
}

/**
 * Merge two data objects, preferring newer data
 */
function mergeData<T>(primary: T, backup: T): T {
  if (typeof primary !== 'object' || typeof backup !== 'object') {
    return primary
  }

  const merged = { ...primary }

  for (const [key, value] of Object.entries(backup)) {
    if (value !== null && value !== undefined) {
      ;(merged as any)[key] = value
    }
  }

  return merged
}
