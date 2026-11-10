/**
 * Production durability guards — shared by social/community/messaging routes.
 * Never report ok:true for non-durable mutations when running production.
 */

export function isProductionRuntime(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    process.env.GHC_ENV === "production"
  )
}

/**
 * For write paths: when durable store is unavailable, fail closed in production.
 * Studio/dev may still return non-durable success if allowNonDurable is true.
 */
export function nonDurableWriteResponse(
  feature: string,
  options?: { allowNonDurableInDev?: boolean; extra?: Record<string, unknown> }
): { body: Record<string, unknown>; status: number } {
  const allowDev = options?.allowNonDurableInDev !== false
  if (isProductionRuntime() || !allowDev) {
    return {
      status: 503,
      body: {
        ok: false,
        durable: false,
        error: "STORE_UNAVAILABLE",
        message: `${feature} requires durable database configuration in production.`,
        ...(options?.extra || {}),
      },
    }
  }
  return {
    status: 200,
    body: {
      ok: true,
      durable: false,
      ...(options?.extra || {}),
    },
  }
}

/** Read paths that cannot invent data in production */
export function nonDurableReadResponse(
  feature: string,
  emptyPayload: Record<string, unknown>
): { body: Record<string, unknown>; status: number } {
  if (isProductionRuntime()) {
    return {
      status: 503,
      body: {
        ok: false,
        durable: false,
        error: "STORE_UNAVAILABLE",
        message: `${feature} is unavailable until the social/community database is configured.`,
        ...emptyPayload,
      },
    }
  }
  return {
    status: 200,
    body: {
      ok: true,
      durable: false,
      ...emptyPayload,
    },
  }
}
