// Advanced optimization hooks for enhanced UX

import { useCallback, useRef, useEffect, useReducer } from 'react'
import { DEBOUNCE_DELAYS, ANIMATION_DURATIONS } from '@/lib/ux-constants'

// Optimize list rendering with memoization and filtering
export function useMemoizedList<T>(
  items: T[],
  filter?: (item: T) => boolean,
  sort?: (a: T, b: T) => number
) {
  return useCallback(() => {
    let result = items
    if (filter) result = result.filter(filter)
    if (sort) result = result.sort(sort)
    return result
  }, [items, filter, sort])()
}

// Debounce values with optional callback
export function useDebounce<T>(value: T, delay: number = DEBOUNCE_DELAYS.search) {
  const [debouncedValue, setDebouncedValue] = useReducer(
    () => value,
    value
  )
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    timeoutRef.current = setTimeout(() => setDebouncedValue(), delay)
    return () => clearTimeout(timeoutRef.current)
  }, [value, delay])

  return debouncedValue
}

// Intersection Observer for lazy loading with performance optimization
export function useIntersectionObserver(
  callback: () => void,
  options = { threshold: 0.1 }
) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        callback()
        observer.unobserve(entry.target)
      }
    }, options)

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [callback, options])

  return ref
}

// Cache fetch requests to reduce network calls
const fetchCache = new Map<string, any>()

export function useCachedFetch(url: string, options?: RequestInit) {
  const cacheKey = `${url}:${JSON.stringify(options || {})}`
  const [data, setData] = useReducer((_, v) => v, null)
  const [loading, setLoading] = useReducer(() => true, false)
  const [error, setError] = useReducer((_, e) => e, null)

  useEffect(() => {
    if (fetchCache.has(cacheKey)) {
      setData(fetchCache.get(cacheKey))
      return
    }

    setLoading()
    fetch(url, options)
      .then((res) => res.json())
      .then((d) => {
        fetchCache.set(cacheKey, d)
        setData(d)
      })
      .catch(setError)
  }, [cacheKey, url, options])

  return { data, loading, error }
}

// Batch state updates for better performance
export function useBatchUpdates<T>(initialState: T) {
  const [state, dispatch] = useReducer(
    (s: T, updates: Partial<T>) => ({ ...s, ...updates }),
    initialState
  )
  const batchRef = useRef<Partial<T>>({})

  const addToBatch = useCallback((updates: Partial<T>) => {
    batchRef.current = { ...batchRef.current, ...updates }
  }, [])

  const flushBatch = useCallback(() => {
    if (Object.keys(batchRef.current).length > 0) {
      dispatch(batchRef.current)
      batchRef.current = {}
    }
  }, [])

  return { state, addToBatch, flushBatch, dispatch }
}

// Optimize performance with advanced optimization strategies
export function useAdvancedOptimization() {
  return {
    useMemoizedList,
    useDebounce,
    useIntersectionObserver,
    useCachedFetch,
    useBatchUpdates,
  }
}
