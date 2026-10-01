/**
 * Domain event ↔ network transport bridge.
 *
 * Today: local EventBus only (offline-safe).
 * Production: plug in WebSocket / SSE without changing domains.
 *
 * Flow:
 *   domainEvents.publish → transportBridge.outbound → remote
 *   remote → transportBridge.inbound → domainEvents.publishRemote (deduped)
 *
 * Production readiness:
 * - Offline outbound queue (bounded) flushed on reconnect
 * - Exponential backoff reconnect
 * - Connection state published for UI reconciliation hooks
 * - No fake remote service when URL is missing
 */

import { domainEvents, type DomainEvent } from "./event-bus"

const MAX_EVENT_JSON = 48_000

function isValidRemoteEvent(data: unknown): data is DomainEvent {
  if (!data || typeof data !== "object") return false
  const e = data as Record<string, unknown>
  if (typeof e.type !== "string" || e.type.length > 80) return false
  if (e.payload !== undefined && e.payload !== null && typeof e.payload !== "object") return false
  if (e.actorId !== undefined && e.actorId !== null && typeof e.actorId !== "string") return false
  if (e.at !== undefined && e.at !== null && typeof e.at !== "number") return false
  try {
    if (JSON.stringify(data).length > MAX_EVENT_JSON) return false
  } catch {
    return false
  }
  return true
}



export type RealtimeConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"

export interface RealtimeTransport {
  connect(): Promise<void> | void
  disconnect(): void
  send(event: DomainEvent): void
  onMessage(handler: (event: DomainEvent) => void): () => void
  /** Optional: report connectivity for offline UI */
  isConnected?(): boolean
  getConnectionState?(): RealtimeConnectionState
}

const OUTBOUND_QUEUE_MAX = 100

function publishConnectionState(state: RealtimeConnectionState, detail?: string) {
  try {
    domainEvents.publish(
      "REALTIME_CONNECTION",
      {
        state,
        detail: detail || null,
        at: Date.now(),
      },
      "system",
      `rt-conn-${state}-${Math.floor(Date.now() / 1000)}`
    )
  } catch {
    /* bus may not be ready during early boot */
  }
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ghc:realtime-connection", { detail: { state, detail } })
      )
    }
  } catch {
    /* */
  }
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
  getConnectionState(): RealtimeConnectionState {
    return this.connected ? "connected" : "disconnected"
  }
}

/**
 * WebSocket transport — connects only when a real URL is provided.
 * Includes offline queue + exponential backoff reconnect.
 */
export class WebSocketTransport implements RealtimeTransport {
  private ws: WebSocket | null = null
  private handlers = new Set<(e: DomainEvent) => void>()
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private shouldRun = false
  private attempt = 0
  private state: RealtimeConnectionState = "disconnected"
  private outboundQueue: DomainEvent[] = []

  constructor(private url: string) {}

  getConnectionState(): RealtimeConnectionState {
    return this.state
  }

  private setState(state: RealtimeConnectionState, detail?: string) {
    this.state = state
    publishConnectionState(state, detail)
  }

  async connect() {
    if (typeof WebSocket === "undefined") return
    if (!this.url || this.url.includes("placeholder")) return
    this.shouldRun = true
    await this.open()
  }

  private open(): Promise<void> {
    if (this.state === "connecting" || this.state === "reconnecting") {
      /* allow parallel open only once */
    }
    this.setState(this.attempt > 0 ? "reconnecting" : "connecting")
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)
        this.ws.onopen = () => {
          this.attempt = 0
          this.setState("connected")
          this.flushOutbound()
          // Signal domains to reconcile stale lists after reconnect
          try {
            domainEvents.publish(
              "SESSION_CLEARED",
              { reason: "realtime_reconnect", action: "reconcile" },
              "system",
              `rt-reconcile-${Date.now()}`
            )
          } catch {
            /* */
          }
          try {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("ghc:realtime-reconcile", { detail: { at: Date.now() } }))
            }
          } catch {
            /* */
          }
          resolve()
        }
        this.ws.onerror = () => {
          /* onclose handles retry */
          reject(new Error("WebSocket connection failed"))
        }
        this.ws.onclose = () => {
          this.ws = null
          if (this.shouldRun) {
            this.setState("reconnecting")
            this.scheduleReconnect()
          } else {
            this.setState("disconnected")
          }
        }
        this.ws.onmessage = (ev) => {
          try {
            const raw = String(ev.data || "")
            if (raw.length > MAX_EVENT_JSON) return
            const data = JSON.parse(raw) as unknown
            if (!isValidRemoteEvent(data)) return
            this.handlers.forEach((h) => h(data))
          } catch {
            /* ignore malformed */
          }
        }
      } catch (e) {
        this.scheduleReconnect()
        reject(e)
      }
    })
  }

  private scheduleReconnect() {
    if (this.retryTimer) return
    if (!this.shouldRun) return
    // Exponential backoff: 1s → 2s → 4s → … max 30s
    const delay = Math.min(30_000, 1000 * Math.pow(2, Math.min(this.attempt, 5)))
    this.attempt += 1
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      if (this.shouldRun) this.open().catch(() => this.scheduleReconnect())
    }, delay)
  }

  private flushOutbound() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const batch = this.outboundQueue.splice(0, this.outboundQueue.length)
    for (const event of batch) {
      try {
        this.ws.send(JSON.stringify(event))
      } catch {
        // put back remaining if send fails mid-batch
        this.outboundQueue.unshift(event, ...batch.slice(batch.indexOf(event) + 1))
        break
      }
    }
  }

  private enqueue(event: DomainEvent) {
    this.outboundQueue.push(event)
    while (this.outboundQueue.length > OUTBOUND_QUEUE_MAX) {
      this.outboundQueue.shift()
    }
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
    this.outboundQueue = []
    this.setState("disconnected")
  }

  send(event: DomainEvent) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(event))
        return
      } catch (e) {
        console.warn("[transport] send failed — queued", e)
      }
    }
    this.enqueue(event)
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
  private browserHooksAttached = false

  /** Swap transport (e.g. after login when WS URL is known) */
  use(transport: RealtimeTransport) {
    this.teardown()
    this.transport = transport
    this.attach()
    this.started = true
    this.attachBrowserHooks()
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

  private attachBrowserHooks() {
    if (this.browserHooksAttached || typeof window === "undefined") return
    this.browserHooksAttached = true
    const onOnline = () => {
      void this.connect()
      try {
        window.dispatchEvent(new CustomEvent("ghc:realtime-reconcile", { detail: { reason: "online" } }))
      } catch {
        /* */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible" && !this.isConnected()) {
        void this.connect()
      }
    }
    window.addEventListener("online", onOnline)
    document.addEventListener("visibilitychange", onVisible)
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

  getConnectionState(): RealtimeConnectionState {
    return this.transport.getConnectionState?.() ?? (this.isConnected() ? "connected" : "disconnected")
  }

  getTransport() {
    return this.transport
  }
}

export const transportBridge = new TransportBridge()

/** Helper: enable WS when env/backend provides a URL */
export function enableWebSocketTransport(url: string) {
  const u = String(url || "").trim()
  const isProd =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  if (isProd && u && !u.startsWith("wss://")) {
    console.warn("[realtime] production requires wss:// — refusing insecure URL")
    transportBridge.startLocal()
    return Promise.resolve()
  }
  const ws = new WebSocketTransport(u)
  transportBridge.use(ws)
  return transportBridge.connect()
}

/**
 * Client bootstrap: prefer NEXT_PUBLIC_GH_REALTIME_URL when set.
 * No-op (local transport) when unset — never invent a fake endpoint.
 */
export function bootstrapRealtimeTransport(): void {
  try {
    const url =
      typeof process !== "undefined"
        ? String(process.env.NEXT_PUBLIC_GH_REALTIME_URL || "").trim()
        : ""
    if (url && !url.includes("placeholder")) {
      void enableWebSocketTransport(url)
      return
    }
  } catch {
    /* */
  }
  transportBridge.startLocal()
}
