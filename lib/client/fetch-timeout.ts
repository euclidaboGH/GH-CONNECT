/** Bounded fetch helpers — prefer these over unbounded client polls. */
export function abortableTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), Math.max(1, ms))
  return {
    signal: controller.signal,
    clear: () => clearTimeout(id),
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 12_000, signal: outer, ...rest } = init
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), Math.max(1, timeoutMs))
  const onOuterAbort = () => controller.abort()
  if (outer) {
    if (outer.aborted) controller.abort()
    else outer.addEventListener("abort", onOuterAbort, { once: true })
  }
  try {
    return await fetch(input, { ...rest, signal: controller.signal })
  } finally {
    clearTimeout(id)
    if (outer) outer.removeEventListener("abort", onOuterAbort)
  }
}
