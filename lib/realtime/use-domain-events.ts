"use client"

/**
 * Subscribe to domainEvents for live UI updates.
 * Components call useDomainEvent / useDomainEvents instead of polling.
 */

import { useEffect, useRef } from "react"
import { domainEvents, type DomainEvent, type DomainEventType } from "./event-bus"

/** Listen to one event type */
export function useDomainEvent(
  type: DomainEventType | "*",
  handler: (event: DomainEvent) => void,
  deps: unknown[] = []
) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    return domainEvents.on(type, (event) => {
      handlerRef.current(event)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, ...deps])
}

/** Listen to several types */
export function useDomainEvents(
  types: DomainEventType[],
  handler: (event: DomainEvent) => void,
  deps: unknown[] = []
) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const unsubs = types.map((type) =>
      domainEvents.on(type, (event) => handlerRef.current(event))
    )
    return () => unsubs.forEach((u) => u())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types.join("|"), ...deps])
}

/**
 * Bridge: when domain events fire, run a cache reconciler.
 * GHCProvider can use this to apply optimistic confirmations later.
 */
export function subscribeDomainCache(
  onEvent: (event: DomainEvent) => void
): () => void {
  return domainEvents.on("*", onEvent)
}
