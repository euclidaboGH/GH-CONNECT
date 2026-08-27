/**
 * Section-scoped transient UI coordinator.
 * Temporary overlays must not survive tab changes, refresh, or major navigation.
 * Persistent data (graph, ledger, conversations list) is never cleared here.
 */

export const TRANSIENT_UI_EVENT = "ghc:close-transient-ui" as const

export type TransientCloseReason =
  | "tab-change"
  | "navigate"
  | "backdrop"
  | "escape"
  | "back"
  | "refresh"
  | "open-other"
  | "manual"

export type TransientCloseDetail = {
  reason?: TransientCloseReason
  /** Active tab after a switch (if any) */
  tab?: string
  /** Optional: only clear UI belonging to this section */
  scope?: string
}

export function dispatchCloseTransientUI(detail: TransientCloseDetail = { reason: "manual" }) {
  if (typeof window === "undefined") return
  try {
    window.dispatchEvent(new CustomEvent(TRANSIENT_UI_EVENT, { detail }))
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent("ghc:close-action-sheets"))
  } catch {
    /* ignore */
  }
}

/** Subscribe to transient dismiss (safe for SSR). */
export function onCloseTransientUI(
  handler: (detail: TransientCloseDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => {}
  const listener = (e: Event) => {
    const detail = ((e as CustomEvent<TransientCloseDetail>).detail || {}) as TransientCloseDetail
    handler(detail)
  }
  window.addEventListener(TRANSIENT_UI_EVENT, listener)
  window.addEventListener("ghc:navigate-tab", listener)
  return () => {
    window.removeEventListener(TRANSIENT_UI_EVENT, listener)
    window.removeEventListener("ghc:navigate-tab", listener)
  }
}
