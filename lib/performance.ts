// Performance optimization utilities

import { useMemo, useCallback, useRef, useEffect, useState, type RefObject } from 'react'

// Memoization helper for filtered/mapped lists
export function useMemoizedList<T>(
  items: T[],
  filterFn?: (item: T) => boolean,
  sortFn?: (a: T, b: T) => number
): T[] {
  return useMemo(() => {
    let result = items
    if (filterFn) result = result.filter(filterFn)
    if (sortFn) result = [...result].sort(sortFn)
    return result
  }, [items, filterFn, sortFn])
}

// Debounce hook for search and filter operations
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(ref: RefObject<HTMLElement | null>) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const target = ref.current
    if (!target) return
    // Older Android System WebViews and embedded Pi Browser versions may not
    // expose IntersectionObserver. Prefer loading over leaving content hidden.
    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setIsVisible(true)
        observer.unobserve(entry.target)
      }
    }, { rootMargin: "160px 0px" })
    observer.observe(target)
    return () => observer.disconnect()
  }, [ref])

  return isVisible
}

// Request deduplication for API calls
const requestCache = new Map<string, Promise<any>>()

export async function cachedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = requestCache.get(key) as Promise<T> | undefined
  if (existing) return existing
  const pending = Promise.resolve().then(fetcher)
  requestCache.set(key, pending)
  try {
    return await pending
  } finally {
    if (requestCache.get(key) === pending) requestCache.delete(key)
  }
}

// Clear cache after timeout
export function setCacheTimeout(key: string, timeout: number) {
  const scheduledValue = requestCache.get(key)
  if (!scheduledValue) return
  setTimeout(() => {
    // Never let an older timer evict a newer in-flight request under the same key.
    if (requestCache.get(key) === scheduledValue) requestCache.delete(key)
  }, Math.max(0, timeout))
}

// Batch updates to reduce re-renders
export function useBatchUpdates<T extends object>(initial: T) {
  const [state, setState] = useState(initial)
  const batchRef = useRef(initial)

  const batchUpdate = useCallback((updates: Partial<T>) => {
    batchRef.current = { ...batchRef.current, ...updates }
  }, [])

  const flushUpdates = useCallback(() => {
    setState(batchRef.current)
  }, [])

  return { state, batchUpdate, flushUpdates }
}

// Memoization for expensive computations
export type MemoizeAsyncOptions = {
  /** Maximum number of resolved values retained. Defaults to 100. */
  maxEntries?: number
  /** Resolved-value lifetime in milliseconds. Defaults to 30 seconds. */
  ttlMs?: number
  /** Override argument serialization for stable domain-specific keys. */
  keyOf?: (args: unknown[]) => string
}

/**
 * Bounded async memoization. Rejected calls are never cached; expired entries
 * are removed on access and least-recently-used entries are evicted on insert.
 * The two-argument call form remains backwards compatible.
 */
export const memoizeAsync = <Args extends any[], Return>(
  fn: (...args: Args) => Promise<Return>,
  options: MemoizeAsyncOptions = {},
): ((...args: Args) => Promise<Return>) => {
  const cache = new Map<string, { value: Return; expiresAt: number }>()
  const pending = new Map<string, Promise<Return>>()
  const maxEntries = Math.max(1, Math.min(1000, Math.floor(options.maxEntries ?? 100)))
  const ttlMs = Math.max(0, options.ttlMs ?? 30_000)

  return async (...args: Args) => {
    let key: string
    try {
      key = options.keyOf ? options.keyOf(args) : JSON.stringify(args) ?? `args:${args.length}`
    } catch {
      // Non-serializable arguments should still work; simply bypass memoization.
      return fn(...args)
    }

    const now = Date.now()
    const cached = cache.get(key)
    if (cached && cached.expiresAt > now) {
      cache.delete(key)
      cache.set(key, cached)
      return cached.value
    }
    if (cached) cache.delete(key)

    const inFlight = pending.get(key)
    if (inFlight) return inFlight

    const task = Promise.resolve().then(() => fn(...args))
    pending.set(key, task)
    try {
      const result = await task
      if (ttlMs > 0) {
        cache.set(key, { value: result, expiresAt: Date.now() + ttlMs })
        while (cache.size > maxEntries) {
          const oldestKey = cache.keys().next().value
          if (oldestKey === undefined) break
          cache.delete(oldestKey)
        }
      }
      return result
    } finally {
      if (pending.get(key) === task) pending.delete(key)
    }
  }
}
