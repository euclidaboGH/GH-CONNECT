/**
 * GreenHaven — Golden mutation pipeline
 *
 * USER ACTION
 *   → DOMAIN ACTION
 *   → VALIDATION
 *   → PERMISSION CHECK
 *   → BACKEND MUTATION (local today / API later)
 *   → DOMAIN EVENT
 *   → REALTIME / NOTIFICATION (event bus)
 *   → LOCAL CACHE UPDATE (caller applies result)
 *   → UI
 *
 * Every write should go through `runMutation`.
 */

import { domainEvents, type DomainEventType } from "../realtime/event-bus"

export type MutationPhase =
  | "validate"
  | "permission"
  | "mutate"
  | "event"
  | "done"
  | "error"

export interface MutationSuccess<T> {
  ok: true
  data: T
  requestId: string
  eventType?: DomainEventType
}

export interface MutationFailure {
  ok: false
  error: string
  code?: string
  phase: MutationPhase
  requestId: string
}

export type MutationResult<T> = MutationSuccess<T> | MutationFailure

function requestId() {
  return `mut_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export interface MutationSpec<TInput, TOutput> {
  name: string
  actorId?: string
  input: TInput
  /** Return error string if invalid */
  validate?: (input: TInput) => string | null
  /** Return error string if not allowed */
  authorize?: (input: TInput) => string | null
  /** Perform the write; throw or return data */
  mutate: (input: TInput, requestId: string) => Promise<TOutput> | TOutput
  /** Domain event after successful mutate */
  eventType?: DomainEventType
  eventPayload?: (data: TOutput, input: TInput) => unknown
}

/**
 * Single entry for domain writes. UI/context never invents parallel paths.
 */
export async function runMutation<TInput, TOutput>(
  spec: MutationSpec<TInput, TOutput>
): Promise<MutationResult<TOutput>> {
  const rid = requestId()
  const actorId = spec.actorId || "current-user"

  try {
    if (spec.validate) {
      const err = spec.validate(spec.input)
      if (err) {
        return { ok: false, error: err, code: "VALIDATION", phase: "validate", requestId: rid }
      }
    }

    if (spec.authorize) {
      const err = spec.authorize(spec.input)
      if (err) {
        return { ok: false, error: err, code: "PERMISSION", phase: "permission", requestId: rid }
      }
    }

    const data = await Promise.resolve(spec.mutate(spec.input, rid))

    if (spec.eventType) {
      const payload = spec.eventPayload ? spec.eventPayload(data, spec.input) : data
      domainEvents.publish(spec.eventType, payload, actorId, rid)
    }

    return { ok: true, data, requestId: rid, eventType: spec.eventType }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[mutation:${spec.name}]`, message)
    return { ok: false, error: message, code: "MUTATE", phase: "error", requestId: rid }
  }
}
