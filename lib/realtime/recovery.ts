import { domainEvents, isDomainEventType, type DomainEvent } from "./event-bus"

let lastSequence = 0
let recovering = false

export async function recoverRealtimeEvents(): Promise<number> {
  if (recovering || typeof window === "undefined") return 0
  recovering = true
  try {
    const res = await fetch(`/api/realtime/events?afterSequence=${lastSequence}&limit=80`, {
      credentials: "include", cache: "no-store", headers: { Accept: "application/json" },
    })
    if (!res.ok) return 0
    const data = (await res.json()) as { ok?: boolean; events?: Array<Record<string, unknown>>; nextSequence?: string }
    if (!data.ok || !Array.isArray(data.events)) return 0
    let applied = 0
    for (const raw of data.events) {
      const type = raw.type
      if (!isDomainEventType(type)) continue
      const sequence = Number(raw.sequence)
      if (Number.isFinite(sequence) && sequence > lastSequence) lastSequence = sequence
      const event: DomainEvent = {
        type,
        actorId: String(raw.actorId || "system"),
        at: Number(raw.at) || Date.now(),
        requestId: raw.requestId ? String(raw.requestId) : undefined,
        origin: "remote",
        payload: raw.payload && typeof raw.payload === "object" ? raw.payload : {},
      }
      domainEvents.publishRemote(event)
      applied += 1
    }
    if (data.nextSequence) lastSequence = Math.max(lastSequence, Number(data.nextSequence) || 0)
    return applied
  } catch {
    return 0
  } finally {
    recovering = false
  }
}

export function resetRealtimeRecoveryCursor() {
  lastSequence = 0
}
