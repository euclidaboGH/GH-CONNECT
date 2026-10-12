/**
 * Map any API error code/message to user-safe copy.
 * Prefer domain-specific mappers when present; never surface SQL/stacks.
 */
import { mapGhcUxError, type GhcUxMessage } from "@/lib/domains/ghc-wallet-ux"

const SOCIAL: Record<string, GhcUxMessage> = {
  AUTH_REQUIRED: {
    title: "Sign in required",
    body: "Sign in with Pi to continue.",
  },
  RATE_LIMITED: {
    title: "Slow down",
    body: "Too many requests. Please wait a moment.",
  },
  FORBIDDEN: {
    title: "Not allowed",
    body: "You do not have permission for this action.",
  },
  NOT_FOUND: {
    title: "Not found",
    body: "That item is unavailable or was removed.",
  },
  INVALID: {
    title: "Check your input",
    body: "Something in the request was incomplete or invalid.",
  },
  SERVER_UNAVAILABLE: {
    title: "Temporarily unavailable",
    body: "Please try again in a moment.",
  },
}

export function mapApiError(raw?: string | null): GhcUxMessage {
  if (!raw) return mapGhcUxError(null)
  const upper = String(raw).trim().toUpperCase()
  if (SOCIAL[upper]) return SOCIAL[upper]
  return mapGhcUxError(raw)
}

export function formatApiErrorToast(raw?: string | null): string {
  const m = mapApiError(raw)
  return m.next ? `${m.title}: ${m.body} ${m.next}` : `${m.title}: ${m.body}`
}
