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
  
  // Setup automatic performance monitoring
  setupPerformanceMonitoring: () => {
    if (typeof window === "undefined") return
    
    // Monitor Core Web Vitals
    if ("PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            analyticsService.trackPerformance(entry.name, entry.value)
          }
        })
        
        observer.observe({ entryTypes: ["largest-contentful-paint", "first-input", "layout-shift"] })
      } catch (e) {
        console.log("[v0] Performance monitoring not supported")
      }
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
