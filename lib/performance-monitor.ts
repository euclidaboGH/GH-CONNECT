// Production Performance Monitoring
// Tracks Core Web Vitals, load times, and user experience metrics

export interface PerformanceMetrics {
  fcp?: number // First Contentful Paint
  lcp?: number // Largest Contentful Paint
  fid?: number // First Input Delay
  cls?: number // Cumulative Layout Shift
  ttfb?: number // Time to First Byte
  pageLoadTime?: number
  apiResponseTimes: Record<string, number[]>
}

export const performanceMonitor = {
  metrics: {
    apiResponseTimes: {},
  } as PerformanceMetrics,

  // Initialize performance monitoring
  init: () => {
    if (typeof window === "undefined") return

    // Monitor Core Web Vitals
    performanceMonitor.monitorCoreWebVitals()

    // Monitor API response times
    performanceMonitor.monitorAPI()

    // Monitor page load
    performanceMonitor.monitorPageLoad()

    // Monitor memory usage (Chrome only)
    performanceMonitor.monitorMemory()
  },

  // Monitor Core Web Vitals
  monitorCoreWebVitals: () => {
    if ("PerformanceObserver" in window) {
      try {
        // Largest Contentful Paint
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1]
          performanceMonitor.metrics.lcp = lastEntry.renderTime || lastEntry.loadTime
          console.log("[v0] LCP:", performanceMonitor.metrics.lcp)
        })
        lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] })

        // Cumulative Layout Shift
        const clsObserver = new PerformanceObserver((list) => {
          let cls = 0
          list.getEntries().forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              cls += entry.value
            }
          })
          performanceMonitor.metrics.cls = cls
          console.log("[v0] CLS:", performanceMonitor.metrics.cls)
        })
        clsObserver.observe({ entryTypes: ["layout-shift"] })
      } catch (e) {
        console.log("[v0] Core Web Vitals monitoring not available")
      }
    }
  },

  // Monitor API response times
  monitorAPI: () => {
    const originalFetch = window.fetch

    window.fetch = function (...args) {
      const startTime = performance.now()
      const endpoint = typeof args[0] === "string" ? args[0] : args[0].url

      return originalFetch.apply(this, args as any).then((response) => {
        const endTime = performance.now()
        const duration = endTime - startTime

        // Track response time
        if (!performanceMonitor.metrics.apiResponseTimes[endpoint]) {
          performanceMonitor.metrics.apiResponseTimes[endpoint] = []
        }
        performanceMonitor.metrics.apiResponseTimes[endpoint].push(duration)

        // Log slow API calls
        if (duration > 3000) {
          console.warn(`[v0] Slow API call: ${endpoint} took ${duration.toFixed(2)}ms`)
        }

        return response
      })
    } as any
  },

  // Monitor page load time
  monitorPageLoad: () => {
    if (document.readyState === "complete") {
      performanceMonitor.recordPageLoadTime()
    } else {
      window.addEventListener("load", () => {
        performanceMonitor.recordPageLoadTime()
      })
    }
  },

  // Record page load time
  recordPageLoadTime: () => {
    const perfData = performance.timing
    const loadTime = perfData.loadEventEnd - perfData.navigationStart
    performanceMonitor.metrics.pageLoadTime = loadTime
    console.log("[v0] Page Load Time:", loadTime)
  },

  // Monitor memory usage (Chrome-specific)
  monitorMemory: () => {
    if ((performance as any).memory) {
      setInterval(() => {
        const memory = (performance as any).memory
        const usedMemory = memory.usedJSHeapSize / 1048576 // Convert to MB

        if (usedMemory > 50) {
          console.warn(`[v0] High memory usage: ${usedMemory.toFixed(2)}MB`)
        }
      }, 30000)
    }
  },

  // Get average API response time
  getAverageAPITime: (endpoint: string): number => {
    const times = performanceMonitor.metrics.apiResponseTimes[endpoint]
    if (!times || times.length === 0) return 0

    const sum = times.reduce((a, b) => a + b, 0)
    return sum / times.length
  },

  // Generate performance report
  getReport: () => {
    return {
      metrics: performanceMonitor.metrics,
      apiSummary: Object.entries(performanceMonitor.metrics.apiResponseTimes).map(
        ([endpoint, times]) => ({
          endpoint,
          avgTime: (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2),
          calls: times.length,
          slowestCall: Math.max(...times).toFixed(2),
        })
      ),
      summary: {
        isOptimal:
          (performanceMonitor.metrics.lcp || 0) < 2500 &&
          (performanceMonitor.metrics.cls || 0) < 0.1,
        warnings: [
          (performanceMonitor.metrics.lcp || 0) > 2500 ? "LCP above threshold" : null,
          (performanceMonitor.metrics.cls || 0) > 0.1 ? "CLS above threshold" : null,
          (performanceMonitor.metrics.pageLoadTime || 0) > 5000
            ? "Page load time slow"
            : null,
        ].filter(Boolean),
      },
    }
  },

  // Log performance data to analytics
  reportMetrics: async () => {
    try {
      await fetch("/api/analytics/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(performanceMonitor.getReport()),
      })
    } catch (error) {
      console.log("[v0] Performance report failed:", error)
    }
  },
}

// Auto-initialize when available
if (typeof window !== "undefined") {
  performanceMonitor.init()
}
