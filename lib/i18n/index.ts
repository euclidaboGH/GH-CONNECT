import { COUNTRY_LANGUAGE_RECOMMENDATIONS } from "@/lib/geography/country-languages"
import { getShellTranslationStatus } from "@/lib/i18n/shell"

export const DEFAULT_LOCALE = "en-US"
export const LOCALE_STORAGE_KEY = "ghc.locale.preference.v1"
export const TRANSLATION_CATALOG_VERSION = "7"

export type WritingDirection = "ltr" | "rtl"
export type LocaleOption = {
  localeTag: string
  languageCode: string
  name: string
  nativeName: string | null
  direction: WritingDirection
  translationAvailable: boolean
  partialTranslationAvailable: boolean
}

// Phase 2 deliberately ships a complete English fallback, not unreviewed machine translations.
const APPROVED_UI_LOCALES = new Set([DEFAULT_LOCALE, "en"])

function canonicalizeLocale(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  try {
    return Intl.getCanonicalLocales(value.trim())[0] ?? null
  } catch {
    return null
  }
}

export function resolveLocale(value: unknown, fallback = DEFAULT_LOCALE): string {
  return canonicalizeLocale(value) ?? canonicalizeLocale(fallback) ?? DEFAULT_LOCALE
}

const LEGACY_LANGUAGE_LOCALES: Record<string, string> = {
  english: DEFAULT_LOCALE, spanish: "es", french: "fr", german: "de", portuguese: "pt", arabic: "ar", hindi: "hi", chinese: "zh-Hans-CN",
}

export function normalizeLanguagePreference(value: unknown): string {
  if (typeof value === "string") {
    const legacy = LEGACY_LANGUAGE_LOCALES[value.trim().toLowerCase()]
    if (legacy) return legacy
  }
  return resolveLocale(value)
}

export function getLocaleDirection(locale: string): WritingDirection {
  const canonical = resolveLocale(locale)
  const exact = COUNTRY_LANGUAGE_RECOMMENDATIONS.find((item) => item.localeTag.toLowerCase() === canonical.toLowerCase())
  if (exact) return exact.direction
  const language = canonical.split("-")[0].toLowerCase()
  return ["ar", "arz", "aec", "fa", "ur", "ps", "sd", "ckb", "he", "yi"].includes(language) ? "rtl" : "ltr"
}

export function isUiTranslationAvailable(locale: string): boolean {
  const language = resolveLocale(locale).split("-")[0].toLowerCase()
  return APPROVED_UI_LOCALES.has(resolveLocale(locale)) || language === "en"
}

export function getLocaleOptions(): LocaleOption[] {
  const byLocale = new Map<string, LocaleOption>()
  byLocale.set(DEFAULT_LOCALE, {
    localeTag: DEFAULT_LOCALE,
    languageCode: "en",
    name: "English",
    nativeName: "English",
    direction: "ltr",
    translationAvailable: true,
    partialTranslationAvailable: false,
  })
  for (const item of COUNTRY_LANGUAGE_RECOMMENDATIONS) {
    const localeTag = resolveLocale(item.localeTag)
    const previous = byLocale.get(localeTag)
    if (previous) continue
    byLocale.set(localeTag, {
      localeTag,
      languageCode: item.languageCode,
      name: item.name,
      nativeName: item.nativeName,
      direction: item.direction,
      translationAvailable: isUiTranslationAvailable(localeTag),
      partialTranslationAvailable: getShellTranslationStatus(localeTag) === "partial",
    })
  }
  for (const [localeTag, name, nativeName] of [
    ["es", "Spanish", "Español"], ["fr", "French", "Français"], ["de", "German", "Deutsch"],
    ["pt", "Portuguese", "Português"], ["ar", "Arabic", "العربية"], ["hi", "Hindi", "हिन्दी"],
    ["zh-Hans-CN", "Chinese (Simplified)", "简体中文"],
  ]) {
    if (!byLocale.has(localeTag)) byLocale.set(localeTag, { localeTag, languageCode: localeTag.split("-")[0], name, nativeName, direction: getLocaleDirection(localeTag), translationAvailable: false, partialTranslationAvailable: getShellTranslationStatus(localeTag) === "partial" })
  }
  return [...byLocale.values()].sort((a, b) => a.name.localeCompare(b.name) || a.localeTag.localeCompare(b.localeTag))
}

export function formatNumber(value: number, locale = DEFAULT_LOCALE, options?: Intl.NumberFormatOptions): string {
  if (!Number.isFinite(value)) return "—"
  try { return new Intl.NumberFormat(resolveLocale(locale), options).format(value) }
  catch { return new Intl.NumberFormat(DEFAULT_LOCALE, options).format(value) }
}

export function formatCurrency(value: number, currency: string, locale = DEFAULT_LOCALE): string {
  if (!Number.isFinite(value) || !/^[A-Z]{3}$/.test(currency)) return "—"
  try { return new Intl.NumberFormat(resolveLocale(locale), { style: "currency", currency }).format(value) }
  catch { return new Intl.NumberFormat(DEFAULT_LOCALE, { style: "currency", currency }).format(value) }
}

export function formatDate(value: string | number | Date, locale = DEFAULT_LOCALE, options: Intl.DateTimeFormatOptions = {}): string {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return ""
  try { return new Intl.DateTimeFormat(resolveLocale(locale), options).format(date) }
  catch { return new Intl.DateTimeFormat(DEFAULT_LOCALE, options).format(date) }
}

export function formatList(values: string[], locale = DEFAULT_LOCALE, options?: Intl.ListFormatOptions): string {
  try { return new Intl.ListFormat(resolveLocale(locale), options).format(values) }
  catch { return new Intl.ListFormat(DEFAULT_LOCALE, options).format(values) }
}

export function getLanguageDisplayName(locale: string, displayLocale = DEFAULT_LOCALE): string {
  const canonical = resolveLocale(locale)
  try { return new Intl.DisplayNames([resolveLocale(displayLocale)], { type: "language" }).of(canonical) ?? canonical }
  catch { return canonical }
}

export const messages = {
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.loading": "Loading…",
  "common.retry": "Try again",
  "language.translationPending": "This interface language is not translated yet. GreenHaven will continue in English until a reviewed translation is available.",
  "language.contentUnchanged": "Messages and user-generated content remain in the language they were written in.",
} as const

export type MessageKey = keyof typeof messages
export function translate(key: MessageKey): string { return messages[key] }
