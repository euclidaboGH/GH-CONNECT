// Offline support utilities

interface StoredAction {
  id: string
  action: string
  data: any
  timestamp: number
  synced: boolean
}

const OFFLINE_STORAGE_KEY = "ghc_offline_queue"
const ONLINE_STATUS_KEY = "ghc_online_status"

export const offlineSupport = {
  // Check if online
  isOnline: (): boolean => {
    return typeof window !== "undefined" && navigator.onLine
  },

  // Queue an action for later sync
  queueAction: (action: string, data: any): string => {
    try {
      const id = `${action}_${Date.now()}_${Math.random()}`
      const stored = localStorage.getItem(OFFLINE_STORAGE_KEY)
      const queue: StoredAction[] = stored ? JSON.parse(stored) : []

      queue.push({
        id,
        action,
        data,
        timestamp: Date.now(),
        synced: false,
      })

      localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(queue))
      return id
    } catch (e) {
      console.warn("[v0] Failed to queue action:", e)
      return ""
    }
  },

  // Get pending actions
  getPendingActions: (): StoredAction[] => {
    try {
      const stored = localStorage.getItem(OFFLINE_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (e) {
      console.warn("[v0] Failed to get pending actions:", e)
      return []
    }
  },

  // Mark action as synced
  markSynced: (actionId: string): void => {
    try {
      const stored = localStorage.getItem(OFFLINE_STORAGE_KEY)
      if (!stored) return

      const queue: StoredAction[] = JSON.parse(stored)
      const updated = queue.filter((a) => a.id !== actionId)
      localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(updated))
    } catch (e) {
      console.warn("[v0] Failed to mark as synced:", e)
    }
  },

  // Clear all pending actions
  clearQueue: (): void => {
    try {
      localStorage.removeItem(OFFLINE_STORAGE_KEY)
    } catch (e) {
      console.warn("[v0] Failed to clear queue:", e)
    }
  },

  // Get cached user data
  getCachedData: (key: string): any => {
    try {
      const stored = localStorage.getItem(`cache_${key}`)
      return stored ? JSON.parse(stored) : null
    } catch (e) {
      console.warn("[v0] Failed to get cached data:", e)
      return null
    }
  },

  // Set cached data
  setCachedData: (key: string, data: any): void => {
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify(data))
    } catch (e) {
      console.warn("[v0] Failed to cache data:", e)
    }
  },

  // Setup online/offline listeners
  setupListeners: (onlineCallback: () => void, offlineCallback: () => void): (() => void) => {
    if (typeof window === "undefined") return () => {}

    window.addEventListener("online", onlineCallback)
    window.addEventListener("offline", offlineCallback)

    return () => {
      window.removeEventListener("online", onlineCallback)
      window.removeEventListener("offline", offlineCallback)
    }
  },
}
