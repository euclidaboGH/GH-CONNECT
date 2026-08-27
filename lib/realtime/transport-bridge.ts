/**
 * Domain event ↔ network transport bridge.
 *
 * Today: local EventBus only (offline-safe).
 * Production: plug in WebSocket / SSE without changing domains.
 *
 * Flow:
 *   domainEvents.publish → transportBridge.outbound → remote
 *   remote → transportBridge.inbound → domainEvents.publishRemote (deduped)
 */

import { domainEvents, type DomainEvent } from "./event-bus"

export interface RealtimeTransport {
  connect(): Promise<void> | void
  disconnect(): void
  send(event: DomainEvent): void
  onMessage(handler: (event: DomainEvent) => void): () => void
  /** Optional: report connectivity for offline UI */
  isConnected?(): boolean
}

/** Local no-op transport — keeps API stable offline */
export class LocalTransport implements RealtimeTransport {
  private handlers = new Set<(e: DomainEvent) => void>()
  private connected = true

  async connect() {
    this.connected = true
  }
  disconnect() {
    this.connected = false
    this.handlers.clear()
  }
  send(event: DomainEvent) {
    void event
  }
  onMessage(handler: (event: DomainEvent) => void) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }
  isConnected() {
    return this.connected
  }
}

/**
 * WebSocket transport scaffold — does not connect until connect() with a real URL.
 */
export class WebSocketTransport implements RealtimeTransport {
  private ws: WebSocket | null = null
  private handlers = new Set<(e: DomainEvent) => void>()
  private queueTimer: ReturnType<typeof setTimeout> | null = null
  private shouldRun = false

  constructor(private url: string) {}

  async connect() {
    if (typeof WebSocket === "undefined") return
    if (!this.url || this.url.includes("placeholder")) return
    this.shouldRun = true
    await this.open()
  }

  private open(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)
        this.ws.onopen = () => resolve()
        this.ws.onerror = () => reject(new Error("WebSocket connection failed"))
        this.ws.onclose = () => {
          this.ws = null
          if (this.shouldRun) this.scheduleReconnect()
        }
        this.ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(String(ev.data)) as DomainEvent
            if (data?.type) this.handlers.forEach((h) => h(data))
          } catch {
            /* ignore malformed */
          }
        }
      } catch (e) {
        reject(e)
      }
    })
  }

  private scheduleReconnect() {
    if (this.retryTimer) return
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      if (this.shouldRun) this.open().catch(() => this.scheduleReconnect())
    }, 3000)
  }

  disconnect() {
    this.shouldRun = false
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    this.ws?.close()
    this.ws = null
    this.handlers.clear()
  }

  send(event: DomainEvent) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(event))
      } catch (e) {
        console.warn("[transport] send failed (offline queue)", e)
      }
    }
    // Offline: drop — domain already applied locally; server sync is future work
  }

  onMessage(handler: (event: DomainEvent) => void) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

class TransportBridge {
  private transport: RealtimeTransport = new LocalTransport()
  private unsubBus: (() => void) | null = null
  private unsubTransport: (() => void) | null = null
  private forwarding = false
  private started = false

  /** Swap transport (e.g. after login when WS URL is known) */
  use(transport: RealtimeTransport) {
    this.teardown()
    this.transport = transport
    this.attach()
    this.started = true
  }

  private attach() {
    // Outbound: local domain events → network (skip remote-origin to avoid loops)
    this.unsubBus = domainEvents.on("*", (event) => {
      if (this.forwarding) return
      if (event.origin === "remote") return
      try {
        this.transport.send(event)
      } catch (e) {
        console.warn("[transport] send failed", e)
      }
    })
    // Inbound: network → domain (deduped inside event bus)
    this.unsubTransport = this.transport.onMessage((event) => {
      this.forwarding = true
      try {
        domainEvents.publishRemote({
          ...event,
          origin: "remote",
        })
      } finally {
        this.forwarding = false
      }
    })
  }

  private teardown() {
    this.unsubBus?.()
    this.unsubTransport?.()
    this.unsubBus = null
    this.unsubTransport = null
    this.transport.disconnect()
    this.started = false
  }

  async connect() {
    if (!this.started) this.startLocal()
    await this.transport.connect()
  }

  /** Start with local transport (safe default, offline-friendly) */
  startLocal() {
    this.use(new LocalTransport())
  }

  isConnected() {
    return this.transport.isConnected?.() ?? false
  }

  getTransport() {
    return this.transport
  }
}

export const transportBridge = new TransportBridge()

/** Helper: enable WS when env/backend provides a URL */
export function enableWebSocketTransport(url: string) {
  const ws = new WebSocketTransport(url)
  transportBridge.use(ws)
  return transportBridge.connect()
}
