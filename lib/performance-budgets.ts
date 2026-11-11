/**
 * Phase III #21 — performance budgets and privacy-safe real-user monitoring contract.
 * Pure functions only (no DOM, no network) so server and tests share one definition.
 * Thresholds follow the public Core Web Vitals guidance: p75 LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1.
 */
export type VitalName = "LCP" | "INP" | "CLS"
export type VitalRating = "good" | "needs-improvement" | "poor"
export type DeviceClass = "low" | "standard" | "high" | "unknown"
export type ConnectionBucket = "slow" | "medium" | "fast" | "unknown"

export const VITAL_NAMES: readonly VitalName[] = Object.freeze(["LCP", "INP", "CLS"])

/** [good upper bound, poor lower bound]. LCP/INP in ms, CLS unitless. */
export const VITAL_THRESHOLDS: Readonly<Record<VitalName, readonly [number, number]>> = Object.freeze({
  LCP: Object.freeze([2500, 4000] as const),
  INP: Object.freeze([200, 500] as const),
  CLS: Object.freeze([0.1, 0.25] as const),
})

/** Product surfaces. The app is a tabbed SPA, so budgets are keyed by surface, never by raw URL. */
export const ROUTE_SURFACES = Object.freeze([
  "home", "feed", "discover", "matches", "messages", "communities", "marketplace",
  "wallet", "rewards", "profile", "notifications", "settings", "legal", "other",
] as const)
export type RouteSurface = (typeof ROUTE_SURFACES)[number]

/** Per-surface p75 budgets: tighter than the global target only where the surface is the hot path. */
export const ROUTE_BUDGETS: Readonly<Record<RouteSurface, { lcpMs: number; inpMs: number; cls: number }>> = Object.freeze(
  Object.fromEntries(ROUTE_SURFACES.map((s) => [s, Object.freeze({ lcpMs: 2500, inpMs: 200, cls: 0.1 })])) as Record<
    RouteSurface, { lcpMs: number; inpMs: number; cls: number }
  >,
)

export function rateVital(name: VitalName, value: number): VitalRating {
  if (!Number.isFinite(value) || value < 0) return "poor"
  const [good, poor] = VITAL_THRESHOLDS[name]
  return value <= good ? "good" : value <= poor ? "needs-improvement" : "poor"
}

/** Nearest-rank percentile; returns null for empty/invalid input. */
export function percentile(values: readonly number[], p: number): number | null {
  const clean = values.filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => a - b)
  if (clean.length === 0 || !(p > 0 && p <= 100)) return null
  return clean[Math.max(0, Math.ceil((p / 100) * clean.length) - 1)]
}

export type BudgetVerdict = { name: VitalName; p75: number | null; samples: number; withinBudget: boolean | null }

/** Evaluate a set of samples against a surface budget. Too few samples => null (never a false pass). */
export function evaluateSurfaceBudget(
  surface: RouteSurface, name: VitalName, samples: readonly number[], minSamples = 30,
): BudgetVerdict {
  const validSampleCount = samples.filter((value) => Number.isFinite(value) && value >= 0).length
  const p75 = percentile(samples, 75)
  if (p75 === null || validSampleCount < minSamples) return { name, p75, samples: validSampleCount, withinBudget: null }
  const b = ROUTE_BUDGETS[surface] ?? ROUTE_BUDGETS.other
  const limit = name === "LCP" ? b.lcpMs : name === "INP" ? b.inpMs : b.cls
  return { name, p75, samples: validSampleCount, withinBudget: p75 <= limit }
}

/** Map a pathname to a coarse surface. Query strings, IDs and hashes are never inspected or retained. */
export function surfaceFromPath(pathname: unknown, activeTab?: unknown): RouteSurface {
  const tab = typeof activeTab === "string" ? activeTab.toLowerCase() : ""
  if ((ROUTE_SURFACES as readonly string[]).includes(tab)) return tab as RouteSurface
  const p = typeof pathname === "string" ? pathname.split(/[?#]/)[0].toLowerCase() : ""
  if (p === "" || p === "/") return "home"
  if (/^\/(privacy|terms|support|portal-setup)(\/|$)/.test(p)) return "legal"
  return "other"
}

export function classifyDevice(memoryGb: unknown, cores: unknown): DeviceClass {
  const m = typeof memoryGb === "number" && Number.isFinite(memoryGb) ? memoryGb : null
  const c = typeof cores === "number" && Number.isFinite(cores) ? cores : null
  if (m === null && c === null) return "unknown"
  if ((m !== null && m <= 2) || (c !== null && c <= 4)) return "low"
  if ((m !== null && m >= 8) && (c === null || c >= 8)) return "high"
  return "standard"
}

export function classifyConnection(effectiveType: unknown, saveData?: unknown): ConnectionBucket {
  if (saveData === true) return "slow"
  switch (effectiveType) {
    case "slow-2g": case "2g": return "slow"
    case "3g": return "medium"
    case "4g": return "fast"
    default: return "unknown"
  }
}

/** Layout-shift entries -> CLS using the session-window definition (<=1 s gap, <=5 s window, max window). */
export function computeCls(shifts: readonly { startTime: number; value: number; hadRecentInput?: boolean }[]): number {
  let best = 0, current = 0, windowStart = 0, last = 0
  for (const s of shifts) {
    if (s.hadRecentInput || !Number.isFinite(s.value) || s.value < 0) continue
    if (current > 0 && (s.startTime - last > 1000 || s.startTime - windowStart > 5000)) { best = Math.max(best, current); current = 0 }
    if (current === 0) windowStart = s.startTime
    current += s.value; last = s.startTime
  }
  return Math.max(best, current)
}

/** Interaction durations -> INP (worst interaction, or ~p98 once there are 50+ interactions). */
export function computeInp(durationsMs: readonly number[]): number | null {
  const d = durationsMs.filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => b - a)
  if (d.length === 0) return null
  return d[Math.min(d.length - 1, Math.floor(d.length / 50))]
}

export type RumSample = {
  name: VitalName; value: number; rating: VitalRating
  surface: RouteSurface; device: DeviceClass; connection: ConnectionBucket
}

const round = (name: VitalName, v: number) => (name === "CLS" ? Math.round(v * 1000) / 1000 : Math.round(v))

/**
 * Strict allowlist validator for client RUM beacons. Unknown keys are dropped (never stored),
 * so URLs, user IDs, query strings and free text cannot be smuggled through.
 */
export function validateRumBatch(raw: unknown, maxSamples = 30): { ok: true; samples: RumSample[] } | { ok: false; error: string } {
  const list = (raw as { samples?: unknown } | null)?.samples
  if (!Array.isArray(list) || list.length === 0 || list.length > maxSamples) return { ok: false, error: "INVALID" }
  const out: RumSample[] = []
  for (const item of list) {
    if (!item || typeof item !== "object") return { ok: false, error: "INVALID" }
    const o = item as Record<string, unknown>
    if (!(VITAL_NAMES as readonly unknown[]).includes(o.name)) return { ok: false, error: "INVALID" }
    const name = o.name as VitalName
    if (typeof o.value !== "number" || !Number.isFinite(o.value) || o.value < 0 || o.value > (name === "CLS" ? 100 : 600_000)) return { ok: false, error: "INVALID" }
    if (!(ROUTE_SURFACES as readonly unknown[]).includes(o.surface)) return { ok: false, error: "INVALID" }
    const device = (["low", "standard", "high", "unknown"] as const).find((x) => x === o.device) ?? "unknown"
    const connection = (["slow", "medium", "fast", "unknown"] as const).find((x) => x === o.connection) ?? "unknown"
    const value = round(name, o.value)
    out.push({ name, value, rating: rateVital(name, value), surface: o.surface as RouteSurface, device, connection })
  }
  return { ok: true, samples: out }
}

/** Sampling is opt-in: rate 0 (default) disables RUM entirely. Invalid values fail closed to 0. */
export function parseSampleRate(raw: unknown): number {
  const n = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : 0
  return Number.isFinite(n) && n > 0 ? Math.min(1, n) : 0
}
export function shouldSample(rate: number, random: number): boolean {
  return rate > 0 && Number.isFinite(random) && random >= 0 && random < rate
}
