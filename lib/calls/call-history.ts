/** Local call attempt history — not a ledger of completed remote media. */

import type { CallKind, CallEndReason } from "./call-types"

export interface CallHistoryEntry {
  callId: string
  peerUserId: string
  peerName: string
  kind: CallKind
  direction: "outgoing" | "incoming"
  endedAt: number
  reason?: CallEndReason
  note?: string
}

const KEY = "ghc.call.history.v1"
const MAX = 40

export function readCallHistory(): CallHistoryEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CallHistoryEntry[]
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : []
  } catch {
    return []
  }
}

export function pushCallHistory(entry: CallHistoryEntry): void {
  if (typeof window === "undefined") return
  try {
    const prev = readCallHistory().filter((e) => e.callId !== entry.callId)
    const next = [entry, ...prev].slice(0, MAX)
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* quota / private mode */
  }
}
