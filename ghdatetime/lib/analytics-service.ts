/**
 * Analytics Service — extended queue/flush helpers.
 *
 * Compatibility: canonical lightweight tracker is `lib/analytics.ts` (`analytics`).
 * Prefer `analytics.track(...)` for product events used by GHCContext.
 * This module may still be imported for batch/queue-style tracking; do not
 * treat it as a second product analytics authority.
 */

interface AnalyticsEvent {
  name: string
  properties?: Record<string, any>
  timestamp?: number
}

interface PerformanceMetric {
  metric: string
  value: number
  unit: string
  timestamp: number
}

export const analyticsService = {
  // Queue for offline event tracking
  eventQueue: [] as AnalyticsEvent[],
  
  // Track custom events
  trackEvent: (name: string, properties?: Record<string, any>) => {
    const event: AnalyticsEvent = {
      name,
      properties,
      timestamp: Date.now(),
    }
    
    // Add to queue for later batch processing
    analyticsService.eventQueue.push(event)
    
    // Batch send every 30 events or 30 seconds
    if (analyticsService.eventQueue.length >= 30) {
      analyticsService.flushEvents()
    }
  },
  
  // Flush queued events to analytics backend
  flushEvents: async () => {
    if (analyticsService.eventQueue.length === 0) return
    
    const events = [...analyticsService.eventQueue]
    analyticsService.eventQueue = []
    
    try {
      // Send to analytics backend (can be configured)
      if (typeof window !== "undefined" && navigator.onLine) {
        await fetch("/api/analytics/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events }),
        })
      }
    } catch (error) {
      // Re-queue events if flush fails
      analyticsService.eventQueue = [...events, ...analyticsService.eventQueue]
    }
  },
  
  // Track page views
  trackPageView: (pageName: string, properties?: Record<string, any>) => {
    analyticsService.trackEvent("page_view", {
      page: pageName,
      ...properties,
    })
  },
  
  // Track user engagement
  trackEngagement: (action: string, target: string, duration?: number) => {
    analyticsService.trackEvent("engagement", {
      action,
      target,
      duration,
    })
  },
  
  // Track errors for debugging
  trackError: (error: Error, context?: string) => {
    analyticsService.trackEvent("error", {
      message: error.message,
      stack: error.stack,
      context,
    })
  },
  
  // Track performance metrics
  trackPerformance: (metric: string, value: number, unit = "ms") => {
    const perfMetric: PerformanceMetric = {
      metric,
      value,
      unit,
      timestamp: Date.now(),
    }

    analyticsService.trackEvent("performance", perfMetric)
  },

  // Track user actions for funnel analysis
  trackConversion: (funnelName: string, step: string) => {
    analyticsService.trackEvent("conversion", {
      funnel: funnelName,
      step,
    })
  },

  /**
   * Normalize a PerformanceEntry into the numeric metric trackPerformance expects.
   * Base PerformanceEntry has name/entryType/startTime/duration only; CLS uses LayoutShift.value,
   * LCP uses startTime, FID (first-input) uses processingStart - startTime.
   */
  metricFromPerformanceEntry: (entry: PerformanceEntry): { value: number; unit: string } | null => {
    switch (entry.entryType) {
      case "layout-shift": {
        // LayoutShift extends PerformanceEntry with `value` (CLS contribution)
        if ("value" in entry && typeof (entry as { value: unknown }).value === "number") {
          return { value: (entry as { value: number }).value, unit: "score" }
        }
        return null
      }
      case "largest-contentful-paint":
        return { value: entry.startTime, unit: "ms" }
      case "first-input": {
        const processingStart = (entry as { processingStart?: unknown }).processingStart
        if (typeof processingStart === "number") {
          return { value: Math.max(0, processingStart - entry.startTime), unit: "ms" }
        }
        return entry.duration > 0 ? { value: entry.duration, unit: "ms" } : null
      }
      default:
        if (entry.duration > 0) return { value: entry.duration, unit: "ms" }
        if (entry.startTime >= 0) return { value: entry.startTime, unit: "ms" }
        return null
    }
  },

  /** Module-level observer so setup is idempotent and can disconnect on unload */
  _performanceObserver: null as PerformanceObserver | null,

  // Setup automatic performance monitoring (browser-only, SSR-safe)
  setupPerformanceMonitoring: () => {
    if (typeof window === "undefined") return
    if (!("PerformanceObserver" in window)) return
    if (analyticsService._performanceObserver) return

    const desired = ["largest-contentful-paint", "first-input", "layout-shift"] as const
    const supported =
      typeof PerformanceObserver.supportedEntryTypes !== "undefined"
        ? desired.filter((t) =>
            (PerformanceObserver.supportedEntryTypes as readonly string[]).includes(t)
          )
        : [...desired]

    if (supported.length === 0) return

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const metric = analyticsService.metricFromPerformanceEntry(entry)
          if (!metric) continue
          analyticsService.trackPerformance(entry.name || entry.entryType, metric.value, metric.unit)
        }
      })
      observer.observe({ entryTypes: supported as string[] })
      analyticsService._performanceObserver = observer

      window.addEventListener(
        "pagehide",
        () => {
          try {
            analyticsService._performanceObserver?.disconnect()
          } catch {
            /* */
          }
          analyticsService._performanceObserver = null
        },
        { once: true }
      )
    } catch {
      // Entry types unsupported in this browser — non-fatal
    }
  },

  // Setup automatic event flush on page unload
  setupAutoFlush: () => {
    if (typeof window === "undefined") return
    
    const flushInterval = setInterval(() => {
      analyticsService.flushEvents()
    }, 30000) // Flush every 30 seconds
    
    window.addEventListener("beforeunload", () => {
      clearInterval(flushInterval)
      // Synchronous flush on page unload
      if (analyticsService.eventQueue.length > 0) {
        navigator.sendBeacon("/api/analytics/events", JSON.stringify({
          events: analyticsService.eventQueue,
        }))
      }
    })
  },
  
  // Get analytics summary
  getEventSummary: () => {
    const summary = analyticsService.eventQueue.reduce((acc, event) => {
      acc[event.name] = (acc[event.name] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return summary
  },
}

// Initialize on client side
if (typeof window !== "undefined") {
  analyticsService.setupPerformanceMonitoring()
  analyticsService.setupAutoFlush()
}
