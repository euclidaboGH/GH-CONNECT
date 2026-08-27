// Performance optimization utilities

import { useMemo, useCallback, useRef, useEffect } from 'react'

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
  const [debouncedValue, setDebouncedValue] = React.useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(ref: React.RefObject<HTMLElement>) {
  const [isVisible, setIsVisible] = React.useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true)
        observer.unobserve(entry.target)
      }
    })

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])

  return isVisible
}

// Request deduplication for API calls
const requestCache = new Map<string, Promise<any>>()

export async function cachedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (!requestCache.has(key)) {
    requestCache.set(key, fetcher())
  }
  return requestCache.get(key)!
}

// Clear cache after timeout
export function setCacheTimeout(key: string, timeout: number) {
  setTimeout(() => requestCache.delete(key), timeout)
}

// Batch updates to reduce re-renders
export function useBatchUpdates<T extends object>(initial: T) {
  const [state, setState] = React.useState(initial)
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
export const memoizeAsync = <Args extends any[], Return>(
  fn: (...args: Args) => Promise<Return>
): ((...args: Args) => Promise<Return>) => {
  const cache = new Map<string, Return>()

  return async (...args: Args) => {
    const key = JSON.stringify(args)
    if (cache.has(key)) return cache.get(key)!

    const result = await fn(...args)
    cache.set(key, result)
    return result
  }
}
