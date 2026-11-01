"use client"

import type { ReactNode } from "react"
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import {
  captureBrowserLocation,
  formatDateTime,
  formatDateTimeWithZone,
  formatRelativeTime,
  getClientLocale,
  getClientTimeZone,
  getLocationPermission,
  getTimeZoneOffsetMinutes,
  regionalHeaders,
  type RegionalContextSnapshot,
  type RegionalLocation,
} from "@/lib/regional-context"

type RegionalContextValue = RegionalContextSnapshot & {
  refreshRegionalContext: () => Promise<void>
  requestLocation: () => Promise<RegionalLocation | null>
  clearLocation: () => void
  headers: (includeLocation?: boolean) => Record<string, string>
  formatDateTime: typeof formatDateTime
  formatDateTimeWithZone: typeof formatDateTimeWithZone
  formatRelativeTime: typeof formatRelativeTime
}

const RegionalContext = createContext<RegionalContextValue | null>(null)

export function RegionalContextProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState("en-US")
  const [timeZone, setTimeZone] = useState("UTC")
  const [offsetMinutes, setOffsetMinutes] = useState(0)
  const [location, setLocation] = useState<RegionalLocation | null>(null)
  const [locationPermission, setLocationPermission] = useState<RegionalContextSnapshot["locationPermission"]>("unknown")

  const refreshRegionalContext = useCallback(async () => {
    const nextLocale = getClientLocale()
    const nextTimeZone = getClientTimeZone()
    setLocale(nextLocale)
    setTimeZone(nextTimeZone)
    setOffsetMinutes(getTimeZoneOffsetMinutes(Date.now(), nextTimeZone))
    setLocationPermission(await getLocationPermission())
  }, [])

  useEffect(() => {
    void refreshRegionalContext()
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshRegionalContext()
    }
    const onLocaleChange = () => void refreshRegionalContext()
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("languagechange", onLocaleChange)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("languagechange", onLocaleChange)
    }
  }, [refreshRegionalContext])

  const requestLocation = useCallback(async () => {
    try {
      const next = await captureBrowserLocation()
      setLocation(next)
      setLocationPermission("granted")
      return next
    } catch (error) {
      const permission = await getLocationPermission()
      setLocationPermission(permission)
      return null
    }
  }, [])

  const clearLocation = useCallback(() => setLocation(null), [])

  const headers = useCallback((includeLocation = false) => regionalHeaders(includeLocation ? location : null), [location])

  const value = useMemo<RegionalContextValue>(() => ({
    locale,
    timeZone,
    offsetMinutes,
    location,
    locationPermission,
    refreshRegionalContext,
    requestLocation,
    clearLocation,
    headers,
    formatDateTime: (value, options) => formatDateTime(value, options, { locale, timeZone }),
    formatDateTimeWithZone: (value) => formatDateTimeWithZone(value, { locale, timeZone }),
    formatRelativeTime: (value, now) => formatRelativeTime(value, now, locale),
  }), [locale, timeZone, offsetMinutes, location, locationPermission, refreshRegionalContext, requestLocation, clearLocation, headers])

  return <RegionalContext.Provider value={value}>{children}</RegionalContext.Provider>
}

export function useRegionalContext(): RegionalContextValue {
  const value = useContext(RegionalContext)
  if (!value) throw new Error("useRegionalContext must be used inside RegionalContextProvider")
  return value
}

export function useOptionalRegionalContext(): RegionalContextValue | null {
  return useContext(RegionalContext)
}
