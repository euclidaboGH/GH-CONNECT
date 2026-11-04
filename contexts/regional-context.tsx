"use client"

import type { ReactNode } from "react"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
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
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, formatCurrency, formatDate, formatList, formatNumber, getLocaleDirection, isUiTranslationAvailable, resolveLocale } from "@/lib/i18n"
import { compareLocaleText, formatCompactNumber, formatPercent, formatPluralMessage, formatRelativeValue, formatUnit, getLocalePresentation, type LocalePresentation } from "@/lib/i18n/formatting"

type RegionalContextValue = RegionalContextSnapshot & {
  refreshRegionalContext: () => Promise<void>
  preferredLocale: string
  localeDirection: "ltr" | "rtl"
  uiTranslationAvailable: boolean
  setPreferredLocale: (locale: string) => void
  resetPreferredLocale: () => void
  requestLocation: () => Promise<RegionalLocation | null>
  clearLocation: () => void
  headers: (includeLocation?: boolean) => Record<string, string>
  formatDateTime: typeof formatDateTime
  formatDateTimeWithZone: typeof formatDateTimeWithZone
  formatRelativeTime: typeof formatRelativeTime
  formatNumber: typeof formatNumber
  formatCurrency: typeof formatCurrency
  formatDate: typeof formatDate
  formatList: typeof formatList
  formatCompactNumber: (value: number, maximumFractionDigits?: number) => string
  formatPercent: (value: number, maximumFractionDigits?: number) => string
  formatUnit: (value: number, unit: Intl.NumberFormatOptions["unit"], options?: Omit<Intl.NumberFormatOptions, "style" | "unit">) => string
  formatRelativeValue: (value: number, unit: Intl.RelativeTimeFormatUnit, numeric?: Intl.RelativeTimeFormatNumeric) => string
  formatPluralMessage: (count: number, forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }) => string
  compareLocaleText: (left: string, right: string, options?: Intl.CollatorOptions) => number
  localePresentation: LocalePresentation
}

const RegionalContext = createContext<RegionalContextValue | null>(null)

export function RegionalContextProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState(DEFAULT_LOCALE)
  // Preserve an explicit in-session choice when embedded browsers block storage.
  const explicitLocaleRef = useRef<string | null | undefined>(undefined)
  const [preferredLocale, setPreferredLocaleState] = useState(DEFAULT_LOCALE)
  const [timeZone, setTimeZone] = useState("UTC")
  const [offsetMinutes, setOffsetMinutes] = useState(0)
  const [location, setLocation] = useState<RegionalLocation | null>(null)
  const [locationPermission, setLocationPermission] = useState<RegionalContextSnapshot["locationPermission"]>("unknown")

  const refreshRegionalContext = useCallback(async () => {
    let savedLocale: string | null = null
    try { savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY) } catch { /* storage may be unavailable in embedded browsers */ }
    if (explicitLocaleRef.current === undefined && savedLocale) {
      explicitLocaleRef.current = resolveLocale(savedLocale)
    }
    const nextLocale = resolveLocale(
      explicitLocaleRef.current !== undefined
        ? explicitLocaleRef.current || getClientLocale()
        : savedLocale || getClientLocale(),
    )
    setPreferredLocaleState(nextLocale)
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

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== LOCALE_STORAGE_KEY) return
      const next = resolveLocale(event.newValue || getClientLocale())
      explicitLocaleRef.current = event.newValue ? next : null
      setPreferredLocaleState(next)
      setLocale(next)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const setPreferredLocale = useCallback((value: string) => {
    const next = resolveLocale(value)
    explicitLocaleRef.current = next
    setPreferredLocaleState(next)
    setLocale(next)
    try { window.localStorage.setItem(LOCALE_STORAGE_KEY, next) } catch { /* preference remains active for this session */ }
  }, [])

  const resetPreferredLocale = useCallback(() => {
    explicitLocaleRef.current = null
    try { window.localStorage.removeItem(LOCALE_STORAGE_KEY) } catch { /* ignore storage failures */ }
    const next = resolveLocale(getClientLocale())
    setPreferredLocaleState(next)
    setLocale(next)
  }, [])

  useEffect(() => {
    if (typeof document === "undefined") return
    document.documentElement.lang = locale
    document.documentElement.dir = getLocaleDirection(locale)
  }, [locale])

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

  const headers = useCallback((includeLocation = false) => ({
    ...regionalHeaders(includeLocation ? location : null),
    "X-GH-Locale": locale,
    "X-GH-Timezone": timeZone,
  }), [location, locale, timeZone])

  const value = useMemo<RegionalContextValue>(() => ({
    locale,
    timeZone,
    offsetMinutes,
    location,
    locationPermission,
    refreshRegionalContext,
    preferredLocale,
    localeDirection: getLocaleDirection(locale),
    uiTranslationAvailable: isUiTranslationAvailable(locale),
    setPreferredLocale,
    resetPreferredLocale,
    requestLocation,
    clearLocation,
    headers,
    formatDateTime: (value, options) => formatDateTime(value, options, { locale, timeZone }),
    formatDateTimeWithZone: (value) => formatDateTimeWithZone(value, { locale, timeZone }),
    formatRelativeTime: (value, now) => formatRelativeTime(value, now, locale),
    formatNumber: (value, options) => formatNumber(value, locale, options),
    formatCurrency: (value, currency) => formatCurrency(value, currency, locale),
    formatDate: (value, options) => formatDate(value, locale, options),
    formatList: (values, options) => formatList(values, locale, options),
    formatCompactNumber: (value, maximumFractionDigits) => formatCompactNumber(value, locale, maximumFractionDigits),
    formatPercent: (value, maximumFractionDigits) => formatPercent(value, locale, maximumFractionDigits),
    formatUnit: (value, unit, options) => formatUnit(value, unit, locale, options),
    formatRelativeValue: (value, unit, numeric) => formatRelativeValue(value, unit, locale, numeric),
    formatPluralMessage: (count, forms) => formatPluralMessage(count, forms, locale),
    compareLocaleText: (left, right, options) => compareLocaleText(left, right, locale, options),
    localePresentation: getLocalePresentation(locale),
  }), [locale, timeZone, offsetMinutes, location, locationPermission, refreshRegionalContext, preferredLocale, setPreferredLocale, resetPreferredLocale, requestLocation, clearLocation, headers])

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
