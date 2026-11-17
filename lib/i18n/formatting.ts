import { DEFAULT_LOCALE, getLocaleDirection, resolveLocale, type WritingDirection } from "@/lib/i18n"

export type LocalePresentation = Readonly<{
  locale: string
  direction: WritingDirection
  numberingSystem: string
  calendar: string
  hourCycle: string
}>

/** Runtime presentation metadata; never changes stored values or business semantics. */
export function getLocalePresentation(locale = DEFAULT_LOCALE): LocalePresentation {
  const canonical = resolveLocale(locale)
  try {
    const resolved = new Intl.DateTimeFormat(canonical).resolvedOptions()
    return Object.freeze({
      locale: canonical,
      direction: getLocaleDirection(canonical),
      numberingSystem: resolved.numberingSystem || "latn",
      calendar: resolved.calendar || "gregory",
      hourCycle: resolved.hourCycle || "h12",
    })
  } catch {
    return Object.freeze({ locale: DEFAULT_LOCALE, direction: "ltr", numberingSystem: "latn", calendar: "gregory", hourCycle: "h12" })
  }
}

export function formatCompactNumber(value: number, locale = DEFAULT_LOCALE, maximumFractionDigits = 1): string {
  if (!Number.isFinite(value)) return "—"
  const digits = Math.min(3, Math.max(0, Math.trunc(maximumFractionDigits)))
  try { return new Intl.NumberFormat(resolveLocale(locale), { notation: "compact", maximumFractionDigits: digits }).format(value) }
  catch { return new Intl.NumberFormat(DEFAULT_LOCALE, { notation: "compact", maximumFractionDigits: digits }).format(value) }
}

export function formatPercent(value: number, locale = DEFAULT_LOCALE, maximumFractionDigits = 0): string {
  if (!Number.isFinite(value)) return "—"
  const digits = Math.min(6, Math.max(0, Math.trunc(maximumFractionDigits)))
  try { return new Intl.NumberFormat(resolveLocale(locale), { style: "percent", maximumFractionDigits: digits }).format(value) }
  catch { return new Intl.NumberFormat(DEFAULT_LOCALE, { style: "percent", maximumFractionDigits: digits }).format(value) }
}

export function formatUnit(value: number, unit: Intl.NumberFormatOptions["unit"], locale = DEFAULT_LOCALE, options: Omit<Intl.NumberFormatOptions, "style" | "unit"> = {}): string {
  if (!Number.isFinite(value) || !unit) return "—"
  const formatOptions: Intl.NumberFormatOptions = { ...options, style: "unit", unit, unitDisplay: options.unitDisplay ?? "short" }
  try { return new Intl.NumberFormat(resolveLocale(locale), formatOptions).format(value) }
  catch {
    try { return new Intl.NumberFormat(DEFAULT_LOCALE, formatOptions).format(value) }
    catch { return `${new Intl.NumberFormat(DEFAULT_LOCALE).format(value)} ${String(unit)}` }
  }
}

export function formatRelativeValue(value: number, unit: Intl.RelativeTimeFormatUnit, locale = DEFAULT_LOCALE, numeric: Intl.RelativeTimeFormatNumeric = "auto"): string {
  if (!Number.isFinite(value)) return ""
  try { return new Intl.RelativeTimeFormat(resolveLocale(locale), { numeric }).format(value, unit) }
  catch { return new Intl.RelativeTimeFormat(DEFAULT_LOCALE, { numeric }).format(value, unit) }
}

/** Selects a grammatical plural form for the active locale; callers supply reviewed wording. */
export function formatPluralMessage(count: number, forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }, locale = DEFAULT_LOCALE): string {
  if (!Number.isFinite(count)) return forms.other.replace(/\{count\}/g, "—")
  let category: Intl.LDMLPluralRule = "other"
  try { category = new Intl.PluralRules(resolveLocale(locale)).select(count) }
  catch { category = new Intl.PluralRules(DEFAULT_LOCALE).select(count) }
  let formattedCount = String(count)
  try { formattedCount = new Intl.NumberFormat(resolveLocale(locale)).format(count) }
  catch { formattedCount = new Intl.NumberFormat(DEFAULT_LOCALE).format(count) }
  return (forms[category] ?? forms.other).replace(/\{count\}/g, formattedCount)
}

/** Locale-aware comparison for user-facing lists; does not alter canonical IDs or sort keys. */
export function compareLocaleText(left: string, right: string, locale = DEFAULT_LOCALE, options: Intl.CollatorOptions = { sensitivity: "base", numeric: true }): number {
  try { return new Intl.Collator(resolveLocale(locale), options).compare(left, right) }
  catch { return new Intl.Collator(DEFAULT_LOCALE, options).compare(left, right) }
}
