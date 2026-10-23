// Network resilience, retry logic, and offline support

export interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  timeoutMs: number
  shouldRetry?: (error: unknown) => boolean
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  timeoutMs: 10000,
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  // Network errors
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return true
  }

  // Timeout
  if (error instanceof Error && error.message.includes('timeout')) {
    return true
  }

  // Server errors that might be transient
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('503') || // Service unavailable
           message.includes('504') || // Gateway timeout
           message.includes('429') || // Too many requests
           message.includes('econnreset') ||
           message.includes('econnrefused') ||
           message.includes('etimedout')
  }

  return false
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const settings = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: unknown
  let delay = settings.initialDelayMs

  for (let attempt = 0; attempt <= settings.maxRetries; attempt++) {
    try {
      // Add timeout wrapper
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Request timeout')),
            settings.timeoutMs
          )
        ),
      ])
    } catch (error) {
      lastError = error

      // Check if we should retry
      if (attempt < settings.maxRetries && 
          (settings.shouldRetry ? settings.shouldRetry(error) : isRetryableError(error))) {
        await new Promise((resolve) => setTimeout(resolve, delay))
        delay = Math.min(delay * settings.backoffMultiplier, settings.maxDelayMs)
      } else {
        throw error
      }
    }
  }

  throw lastError
}

/**
 * Offline action queue for storing failed requests
 */
export interface QueuedAction {
  id: string
  type: string
  payload: unknown
  timestamp: number
  retries: number
  maxRetries: number
}

const OFFLINE_QUEUE_KEY = 'gh-offline-queue'

export class OfflineQueue {
  private queue: QueuedAction[] = []

  constructor() {
    this.loadFromStorage()
  }

  /**
   * Add an action to the queue
   */
  addAction(action: Omit<QueuedAction, 'id' | 'timestamp' | 'retries'>): string {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const queuedAction: QueuedAction = {
      ...action,
      id,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: action.maxRetries || 3,
    }

    this.queue.push(queuedAction)
    this.saveToStorage()

    return id
  }

  /**
   * Get all queued actions
   */
  getQueue(): QueuedAction[] {
    return [...this.queue]
  }

  /**
   * Get actions by type
   */
  getActionsByType(type: string): QueuedAction[] {
    return this.queue.filter((action) => action.type === type)
  }

  /**
   * Remove an action from the queue
   */
  removeAction(id: string): boolean {
    const index = this.queue.findIndex((action) => action.id === id)
    if (index > -1) {
      this.queue.splice(index, 1)
      this.saveToStorage()
      return true
    }
    return false
  }

  /**
   * Update retry count for an action
   */
  incrementRetry(id: string): boolean {
    const action = this.queue.find((a) => a.id === id)
    if (action) {
      action.retries++
      this.saveToStorage()
      return true
    }
    return false
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = []
    this.saveToStorage()
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0
  }

  /**
   * Save queue to localStorage
   */
  private canUseStorage(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
  }

  private saveToStorage(): void {
    if (!this.canUseStorage()) return
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.queue))
    } catch (error) {
      console.warn('[v0] Failed to save offline queue:', error)
    }
  }

  /**
   * Load queue from localStorage (no-op on server / SSR)
   */
  private loadFromStorage(): void {
    if (!this.canUseStorage()) {
      this.queue = []
      return
    }
    try {
      const stored = localStorage.getItem(OFFLINE_QUEUE_KEY)
      if (stored) {
        this.queue = JSON.parse(stored)
      }
    } catch (error) {
      console.warn('[v0] Failed to load offline queue:', error)
      this.queue = []
    }
  }
}

/**
 * Connection status monitoring
 */
export class ConnectionMonitor {
  private isOnline: boolean =
    typeof navigator !== 'undefined' ? navigator.onLine : true
  private listeners: ((isOnline: boolean) => void)[] = []
  private connectivityTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.setupListeners()
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return
    const handleOnline = () => {
      this.setOnlineStatus(true)
      void this.checkConnectivity()
      this.scheduleConnectivityCheck()
    }
    const handleOffline = () => {
      this.setOnlineStatus(false)
      this.stopConnectivityChecks()
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') this.scheduleConnectivityCheck()
      else this.stopConnectivityChecks()
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibility)
    // Do not run a background timer until a consumer subscribes.
  }

  private scheduleConnectivityCheck(): void {
    if (typeof window === 'undefined' || document.visibilityState !== 'visible' || this.listeners.length === 0) return
    this.stopConnectivityChecks()
    this.connectivityTimer = setTimeout(async () => {
      await this.checkConnectivity()
      this.scheduleConnectivityCheck()
    }, 60000)
  }

  private stopConnectivityChecks(): void {
    if (this.connectivityTimer !== null) {
      clearTimeout(this.connectivityTimer)
      this.connectivityTimer = null
    }
  }

  private async checkConnectivity(): Promise<void> {
    if (typeof window === 'undefined' || document.visibilityState !== 'visible' || !navigator.onLine) return
    try {
      await Promise.race([
        fetch('/api/health', { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' }),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('Connectivity check timeout')), 4000)
        ),
      ])
      this.setOnlineStatus(true)
    } catch {
      this.setOnlineStatus(false)
    }
  }

  private setOnlineStatus(online: boolean): void {
    if (this.isOnline !== online) {
      this.isOnline = online
      this.notifyListeners()
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try { listener(this.isOnline) } catch (error) { console.error('[v0] Connection monitor listener error:', error) }
    })
  }

  getStatus(): boolean { return this.isOnline }

  subscribe(listener: (isOnline: boolean) => void): () => void {
    this.listeners.push(listener)
    try { listener(this.isOnline) } catch { /* consumer callback is isolated */ }
    this.scheduleConnectivityCheck()
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
      if (this.listeners.length === 0) this.stopConnectivityChecks()
    }
  }

  async waitForConnection(): Promise<void> {
    if (this.isOnline) return
    return new Promise((resolve) => {
      const unsubscribe = this.subscribe((online) => {
        if (online) { unsubscribe(); resolve() }
      })
    })
  }
}

// Export singleton instances
export const offlineQueue = new OfflineQueue()
export const connectionMonitor = new ConnectionMonitor()
