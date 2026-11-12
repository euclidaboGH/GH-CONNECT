"use client"

import { useCallback, useEffect, useState } from "react"

const KEY_PREFIX = "ghc.filters.v1"
const ACCOUNT_KEY = /^[a-zA-Z0-9:_-]{1,180}$/

/** Persist non-sensitive filter preferences per authenticated account; never share anonymous state. */
export function useAccountFilterState<T extends Record<string, unknown>>(
  surface: string,
  accountId: string,
  defaults: T,
  validate: (value: unknown) => T,
) {
  const [value, setValue] = useState<T>(defaults)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const storageKey = ACCOUNT_KEY.test(accountId) && accountId !== "current-user" && accountId !== "anonymous"
    ? `${KEY_PREFIX}.${surface}.${accountId}`
    : null
  const hydrated = loadedKey === (storageKey || "__anonymous__")

  useEffect(() => {
    if (!storageKey) {
      setValue(defaults)
      setLoadedKey("__anonymous__")
      return
    }
    setLoadedKey(null)
    try {
      const raw = window.localStorage.getItem(storageKey)
      setValue(raw ? validate(JSON.parse(raw)) : defaults)
    } catch {
      setValue(defaults)
    }
    setLoadedKey(storageKey)
  }, [storageKey, validate, defaults])

  useEffect(() => {
    if (!hydrated || !storageKey) return
    try { window.localStorage.setItem(storageKey, JSON.stringify(value)) } catch { /* Storage may be disabled or full. */ }
  }, [hydrated, storageKey, value])

  const reset = useCallback(() => setValue(defaults), [defaults])
  const update = useCallback(<K extends keyof T>(key: K, next: T[K]) => {
    setValue((current) => ({ ...(hydrated ? current : defaults), [key]: next }))
  }, [hydrated, defaults])
  return { value: hydrated ? value : defaults, setValue, update, reset, hydrated }
}
