// Activity logging and basic analytics

export type EventType =
  | "user_signup"
  | "user_login"
  | "user_logout"
  | "profile_update"
  | "post_created"
  | "post_liked"
  | "comment_added"
  | "message_sent"
  | "swipe_action"
  | "match_found"
  | "user_blocked"
  | "user_reported"
  | "settings_changed"

interface AnalyticsEvent {
  type: EventType
  timestamp: number
  userId?: string
  data?: Record<string, any>
  sessionId: string
}

const ANALYTICS_STORAGE_KEY = "ghc_analytics"
const SESSION_ID_KEY = "ghc_session_id"
const MAX_EVENTS = 1000

class Analytics {
  private sessionId: string

  constructor() {
    this.sessionId = this.getOrCreateSessionId()
  }

  private getOrCreateSessionId(): string {
    try {
      const stored = localStorage.getItem(SESSION_ID_KEY)
      if (stored) return stored

      const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      localStorage.setItem(SESSION_ID_KEY, newId)
      return newId
    } catch {
      return `session_${Date.now()}`
    }
  }

  trackEvent(type: EventType, data?: Record<string, any>, userId?: string): void {
    try {
      const event: AnalyticsEvent = {
        type,
        timestamp: Date.now(),
        userId,
        data,
        sessionId: this.sessionId,
      }

      const stored = localStorage.getItem(ANALYTICS_STORAGE_KEY)
      const events: AnalyticsEvent[] = stored ? JSON.parse(stored) : []

      events.push(event)

      // Keep only last MAX_EVENTS
      const trimmed = events.slice(-MAX_EVENTS)
      localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(trimmed))

      console.log("[v0] Analytics event:", type, data)
    } catch (e) {
      console.warn("[v0] Failed to track event:", e)
    }
  }

  getEvents(): AnalyticsEvent[] {
    try {
      const stored = localStorage.getItem(ANALYTICS_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  getSessionEvents(): AnalyticsEvent[] {
    return this.getEvents().filter((e) => e.sessionId === this.sessionId)
  }

  getEventStats(): Record<EventType, number> {
    const events = this.getEvents()
    const stats: Record<EventType, number> = {} as any

    events.forEach((e) => {
      stats[e.type] = (stats[e.type] || 0) + 1
    })

    return stats
  }

  clearEvents(): void {
    try {
      localStorage.removeItem(ANALYTICS_STORAGE_KEY)
    } catch {
      // Ignore
    }
  }
}

export const analytics = new Analytics()
