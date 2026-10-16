/**
 * Presence + typing indicators (lightweight, client-side).
 * When WebSocket transport is live, presence events fan out via domainEvents.
 */

import { domainEvents } from "./event-bus"

export type PresenceStatus = "online" | "away" | "offline"

export interface PresenceEntry {
  userId: string
  status: PresenceStatus
  lastSeen: number
  typingIn?: string // conversationId
}

type Listener = () => void

class PresenceStore {
  private map = new Map<string, PresenceEntry>()
  private listeners = new Set<Listener>()
  private selfId = "current-user"
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null

  setSelf(userId: string) {
    this.selfId = userId
    this.touch(userId, "online")
  }

  touch(userId: string, status: PresenceStatus = "online") {
    this.map.set(userId, {
      userId,
      status,
      lastSeen: Date.now(),
      typingIn: this.map.get(userId)?.typingIn,
    })
    this.emit()
  }

  setTyping(userId: string, conversationId: string | null) {
    const prev = this.map.get(userId)
    this.map.set(userId, {
      userId,
      status: prev?.status || "online",
      lastSeen: Date.now(),
      typingIn: conversationId || undefined,
    })
    this.emit()
    if (conversationId) {
      domainEvents.publish(
        "TYPING_STARTED",
        { conversationId, userId },
        userId
      )
    } else if (prev?.typingIn) {
      domainEvents.publish(
        "TYPING_STOPPED",
        { conversationId: prev.typingIn, userId },
        userId
      )
    }
  }

  setStatus(userId: string, status: PresenceStatus) {
    const lastSeen = Date.now()
    this.map.set(userId, {
      userId,
      status,
      lastSeen,
      typingIn: this.map.get(userId)?.typingIn,
    })
    this.emit()
    domainEvents.publish(
      "PRESENCE_CHANGED",
      { userId, status, lastSeen },
      userId
    )
  }

  isOnline(userId: string): boolean {
    const e = this.map.get(userId)
    if (!e) return false
    if (e.status === "offline") return false
    // Consider offline after 90s without heartbeat
    return Date.now() - e.lastSeen < 90_000
  }

  lastSeen(userId: string): number | null {
    return this.map.get(userId)?.lastSeen ?? null
  }

  isTypingIn(userId: string, conversationId: string): boolean {
    const e = this.map.get(userId)
    return Boolean(e?.typingIn && e.typingIn === conversationId)
  }

  getTypers(conversationId: string): string[] {
    const out: string[] = []
    for (const e of this.map.values()) {
      if (e.typingIn === conversationId && e.userId !== this.selfId) {
        out.push(e.userId)
      }
    }
    return out
  }

  /** Format last-seen for UI */
  formatLastSeen(userId: string): string {
    if (this.isOnline(userId)) return "Active now"
    const ts = this.lastSeen(userId)
    if (!ts) return "Offline"
    const mins = Math.floor((Date.now() - ts) / 60_000)
    if (mins < 1) return "Just now"
    if (mins < 60) return `Active ${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `Active ${hours}h ago`
    return `Active ${Math.floor(hours / 24)}d ago`
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    this.listeners.forEach((fn) => {
      try {
        fn()
      } catch {
        /* */
      }
    })
  }

  /** Heartbeat for current user */
  startHeartbeat(intervalMs = 30_000) {
    this.stopHeartbeat()
    this.touch(this.selfId, "online")
    this.heartbeatTimer = setInterval(() => {
      this.touch(this.selfId, "online")
    }, intervalMs)
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}

export const presenceStore = new PresenceStore()

/** Hook-friendly snapshot */
export function getPresenceSnapshot(userId: string) {
  return {
    online: presenceStore.isOnline(userId),
    lastSeenLabel: presenceStore.formatLastSeen(userId),
    lastSeen: presenceStore.lastSeen(userId),
  }
}
