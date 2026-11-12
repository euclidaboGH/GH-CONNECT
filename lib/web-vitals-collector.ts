"use client"
/**
 * Phase III #21 — privacy-safe real-user vitals collector. Ships DARK: sampling is controlled by
 * NEXT_PUBLIC_RUM_SAMPLE_RATE (default 0 = no observers, no network). Sends one coarse beacon per
 * page view on hide: metric values + surface/device/connection buckets only. No URL, user ID,
 * query string, cookie, or free text is collected. Never use for financial or authorization decisions.
 */
import {
  classifyConnection, classifyDevice, computeCls, computeInp, parseSampleRate, shouldSample, surfaceFromPath,
  type RumSample,
} from "./performance-budgets"

let started = false

export function startWebVitalsCollector(): void {
  if (started || typeof window === "undefined" || typeof PerformanceObserver === "undefined") return
  const rate = parseSampleRate(process.env.NEXT_PUBLIC_RUM_SAMPLE_RATE)
  if (!shouldSample(rate, Math.random())) return
  started = true

  const supported = (PerformanceObserver.supportedEntryTypes ?? []) as readonly string[]
  type SurfaceMetrics = {
    lcp: number | null
    shifts: { startTime: number; value: number; hadRecentInput?: boolean }[]
    interactions: Map<number, number>
  }
  const metrics = new Map<ReturnType<typeof surfaceFromPath>, SurfaceMetrics>()
  const activeSurface = () => {
    const panel = document.querySelector<HTMLElement>('[data-gh-tab-panel][aria-hidden="false"]')
    return surfaceFromPath(location.pathname, panel?.dataset.ghTabPanel)
  }
  const surfaceForTarget = (target: unknown): ReturnType<typeof surfaceFromPath> => {
    if (typeof Element !== "undefined" && target instanceof Element) {
      const panel = target.closest<HTMLElement>("[data-gh-tab-panel]")
      const tab = panel?.dataset.ghTabPanel
      if (tab) return surfaceFromPath(location.pathname, tab)
    }
    return activeSurface()
  }
  const bucket = (surface: ReturnType<typeof surfaceFromPath>): SurfaceMetrics => {
    const existing = metrics.get(surface)
    if (existing) return existing
    const created: SurfaceMetrics = { lcp: null, shifts: [], interactions: new Map() }
    metrics.set(surface, created)
    return created
  }

  const observers: PerformanceObserver[] = []
  const observe = (type: string, cb: (entries: PerformanceEntry[]) => void, extra: Record<string, unknown> = {}) => {
    if (!supported.includes(type)) return
    try {
      const o = new PerformanceObserver((list) => cb(list.getEntries()))
      o.observe({ type, buffered: true, ...extra } as PerformanceObserverInit)
      observers.push(o)
    } catch { /* unsupported in this WebView: non-fatal */ }
  }

  observe("largest-contentful-paint", (entries) => {
    const last = entries[entries.length - 1] as (PerformanceEntry & { element?: Element | null }) | undefined
    if (last) bucket(surfaceForTarget(last.element)).lcp = last.startTime
  })
  observe("layout-shift", (entries) => {
    for (const entry of entries as (PerformanceEntry & {
      value: number
      hadRecentInput?: boolean
      sources?: { node?: Node | null }[]
    })[]) {
      const sourceNode = entry.sources?.find((source) => source.node)?.node
      const target = sourceNode instanceof Element ? sourceNode : sourceNode?.parentElement
      const surface = surfaceForTarget(target)
      const targetBucket = bucket(surface)
      if (targetBucket.shifts.length < 500) {
        targetBucket.shifts.push({ startTime: entry.startTime, value: entry.value, hadRecentInput: entry.hadRecentInput })
      }
    }
  })
  observe("event", (entries) => {
    for (const entry of entries as (PerformanceEntry & { interactionId?: number; duration: number; target?: EventTarget | null })[]) {
      if (!entry.interactionId) continue
      const targetBucket = bucket(surfaceForTarget(entry.target))
      const previous = targetBucket.interactions.get(entry.interactionId) ?? 0
      if (entry.duration > previous && (targetBucket.interactions.size < 200 || targetBucket.interactions.has(entry.interactionId))) {
        targetBucket.interactions.set(entry.interactionId, entry.duration)
      }
    }
  }, { durationThreshold: 40 })

  let sent = false
  const flush = (force = false) => {
    if (sent || (!force && document.visibilityState !== "hidden")) return
    sent = true
    observers.forEach((o) => { try { o.disconnect() } catch { /* */ } })
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string; saveData?: boolean } }
    const fallback = activeSurface()
    if (metrics.size === 0) bucket(fallback)
    const samples: Pick<RumSample, "name" | "value" | "surface" | "device" | "connection">[] = []
    for (const [surface, values] of metrics) {
      const base = {
        surface,
        device: classifyDevice(nav.deviceMemory, nav.hardwareConcurrency),
        connection: classifyConnection(nav.connection?.effectiveType, nav.connection?.saveData),
      }
      if (values.lcp !== null) samples.push({ name: "LCP", value: values.lcp, ...base })
      const inp = computeInp([...values.interactions.values()])
      if (inp !== null) samples.push({ name: "INP", value: inp, ...base })
      // A zero CLS is meaningful only for a surface with an observed layout-shift
      // stream; do not fabricate a zero for tabs the visitor never opened.
      if (values.shifts.length > 0) samples.push({ name: "CLS", value: computeCls(values.shifts), ...base })
    }
    try {
      navigator.sendBeacon?.("/api/analytics/vitals", new Blob([JSON.stringify({ samples })], { type: "application/json" }))
    } catch { /* best-effort telemetry */ }
  }
  document.addEventListener("visibilitychange", () => flush())
  window.addEventListener("pagehide", () => flush(true), { once: true })
}
