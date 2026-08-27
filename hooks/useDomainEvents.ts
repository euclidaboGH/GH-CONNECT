"use client"

/**
 * Subscribe to domain events (local bus today → realtime transport later).
 */

import { useEffect } from "react"
import { domainEvents, type DomainEvent, type DomainEventType } from "@/lib/realtime/event-bus"

export function useDomainEvents(
  type: DomainEventType | "*",
  handler: (event: DomainEvent) => void
) {
  useEffect(() => {
    return domainEvents.on(type, handler)
  }, [type, handler])
}
