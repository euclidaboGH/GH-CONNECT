/**
 * Search Cache Utility
 * Provides memoization and intelligent caching for search results
 * Optimizes performance especially on slower devices
 */

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

export class SearchCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map()
  private readonly maxSize: number
  private readonly defaultTtl: number

  constructor(maxSize: number = 50, defaultTtl: number = 5 * 60 * 1000) {
    this.maxSize = maxSize
    this.defaultTtl = defaultTtl
  }

  /**
   * Generate a cache key from search parameters
   */
  static createKey(...parts: (string | number | boolean | object)[]): string {
    return parts
      .map((part) => {
        if (typeof part === "object") {
          return JSON.stringify(part)
        }
        return String(part)
      })
      .join("|")
  }

  /**
   * Get cached data if valid
   */
  get(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Check if cache has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  /**
   * Set cache with automatic size management
   */
  set(key: string, data: T, ttl: number = this.defaultTtl): void {
    // Remove oldest entry if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      )[0]?.[0]

      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache stats for debugging
   */
  getStats(): { size: number; capacity: number; hitRate: number } {
    return {
      size: this.cache.size,
      capacity: this.maxSize,
      hitRate: 0, // Would need to track hits/misses separately
    }
  }
}

/**
 * Memoize a search function with automatic caching
 */
export function memoizeSearch<Args extends unknown[], T>(
  fn: (...args: Args) => T,
  options: { ttl?: number; keyGenerator?: (...args: Args) => string } = {}
) {
  const cache = new SearchCache<T>(50, options.ttl || 5 * 60 * 1000)
  const defaultKeyGenerator = (...args: Args) => SearchCache.createKey(...args)
  const keyGenerator = options.keyGenerator || defaultKeyGenerator

  return (...args: Args): T => {
    const key = keyGenerator(...args)
    const cached = cache.get(key)

    if (cached !== null) {
      return cached
    }

    const result = fn(...args)
    cache.set(key, result, options.ttl)
    return result
  }
}

/**
 * Batch search results and paginate for better performance
 */
export function paginateResults<T>(
  results: T[],
  page: number = 0,
  pageSize: number = 50
): { data: T[]; total: number; page: number; pageSize: number; hasMore: boolean } {
  const start = page * pageSize
  const end = start + pageSize
  const data = results.slice(start, end)
  const total = results.length
  const hasMore = end < total

  return {
    data,
    total,
    page,
    pageSize,
    hasMore,
  }
}

/**
 * Debounce search with rejection on rapid successive calls
 */
export function debounceSearch<Args extends unknown[], T>(
  fn: (...args: Args) => Promise<T>,
  delay: number = 300
): (...args: Args) => Promise<T | null> {
  let timeoutId: NodeJS.Timeout | null = null
  let lastArgs: Args | null = null

  return (...args: Args): Promise<T | null> => {
    return new Promise((resolve) => {
      lastArgs = args

      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      timeoutId = setTimeout(async () => {
        if (lastArgs === args) {
          try {
            const result = await fn(...args)
            resolve(result)
          } catch (error) {
            console.error("[v0] Debounced search error:", error)
            resolve(null)
          }
        }
        timeoutId = null
      }, delay)
    })
  }
}
