/**
 * Map technical errors to calm, actionable user copy.
 * Never surface stack traces, tokens, or internal IDs.
 */

export type RecoveryAction = "retry" | "refresh" | "go_back" | "dismiss" | "check_connection"

export function toUserFacingError(err: unknown): {
  title: string
  message: string
  recovery: RecoveryAction[]
} {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Something went wrong"

  const lower = raw.toLowerCase()

  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("offline") ||
    lower.includes("failed to fetch")
  ) {
    return {
      title: "Connection problem",
      message: "Check your network and try again. Your draft or pending action was not lost if it was saved locally.",
      recovery: ["check_connection", "retry"],
    }
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return {
      title: "That took too long",
      message: "The server did not respond in time. Please retry — we did not mark this as successful.",
      recovery: ["retry", "refresh"],
    }
  }
  if (lower.includes("permission") || lower.includes("forbidden") || lower.includes("not allowed")) {
    return {
      title: "Not allowed",
      message: "You may not have permission for this action, or privacy settings blocked it.",
      recovery: ["go_back", "dismiss"],
    }
  }
  if (lower.includes("not found") || lower.includes("404")) {
    return {
      title: "Not found",
      message: "This content may have been removed or is no longer available.",
      recovery: ["refresh", "go_back"],
    }
  }

  return {
    title: "Something went wrong",
    message: "Please try again. If it keeps happening, refresh this section.",
    recovery: ["retry", "refresh", "go_back"],
  }
}

export function logClientError(scope: string, err: unknown, extra?: Record<string, unknown>) {
  try {
    const message = err instanceof Error ? err.message : String(err)
    // Avoid logging tokens / large payloads
    console.warn(`[GreenHaven] ${scope}:`, message, extra ? { ...extra } : "")
  } catch {
    /* ignore */
  }
}
