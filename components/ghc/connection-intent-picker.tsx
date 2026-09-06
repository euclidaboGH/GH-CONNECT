"use client"

/**
 * Connection intent picker — shown before sendUnifiedConnectionRequest.
 * Multi-select; optional note. Accessible dialog (role=dialog, Escape, focus).
 */

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { X } from "lucide-react"
import {
  CONNECTION_INTENT_OPTIONS,
  type ConnectionIntentId,
  resolveUserIntents,
} from "@/lib/connection-intents"
import { IdentityService } from "@/lib/identity/identity-service"

/** Primary intents surfaced in the picker (prompt list + existing contract) */
const PICKER_INTENT_IDS: ConnectionIntentId[] = [
  "friendship",
  "professional",
  "collaboration",
  "mentorship",
  "learning",
  "business",
  "communities",
  "volunteering",
  "events",
]

const PICKER_OPTIONS = CONNECTION_INTENT_OPTIONS.filter((o) =>
  PICKER_INTENT_IDS.includes(o.id)
)

export interface ConnectionIntentPickerProps {
  open: boolean
  targetName?: string
  /** Preselected intents (defaults from user profile/intents) */
  defaultIntents?: ConnectionIntentId[]
  maxIntents?: number
  busy?: boolean
  error?: string | null
  onConfirm: (result: { intents: ConnectionIntentId[]; note?: string }) => void
  onCancel: () => void
}

export function ConnectionIntentPicker({
  open,
  targetName,
  defaultIntents,
  maxIntents = 3,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: ConnectionIntentPickerProps) {
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const me = IdentityService.getCurrentUserId()
  const seed =
    defaultIntents && defaultIntents.length > 0
      ? defaultIntents
      : resolveUserIntents(me, null).filter((id) => PICKER_INTENT_IDS.includes(id)).slice(0, maxIntents)

  const [selected, setSelected] = useState<ConnectionIntentId[]>(seed)
  const [note, setNote] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSelected(
      (defaultIntents && defaultIntents.length > 0
        ? defaultIntents
        : resolveUserIntents(me, null).filter((id) => PICKER_INTENT_IDS.includes(id))
      ).slice(0, maxIntents)
    )
    setNote("")
    setLocalError(null)
  }, [open, defaultIntents, maxIntents, me])

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>("button, [href], input, textarea")?.focus()
    }, 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.preventDefault()
        onCancel()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener("keydown", onKey)
      prev?.focus?.()
    }
  }, [open, busy, onCancel])

  const toggle = useCallback(
    (id: ConnectionIntentId) => {
      setLocalError(null)
      setSelected((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id)
        if (prev.length >= maxIntents) {
          setLocalError(`Choose up to ${maxIntents} intents`)
          return prev
        }
        return [...prev, id]
      })
    },
    [maxIntents]
  )

  if (!open) return null

  const displayError = error || localError

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-background p-4 shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 id={titleId} className="text-base font-bold text-foreground">
              What would you like to connect about?
            </h2>
            <p id={descId} className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              {targetName
                ? `Help ${targetName} understand why you want to connect. This does not guarantee acceptance.`
                : "Help them understand why you want to connect. This does not guarantee acceptance."}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div
          className="grid grid-cols-2 gap-2"
          role="group"
          aria-label="Connection intents"
        >
          {PICKER_OPTIONS.map((opt) => {
            const on = selected.includes(opt.id)
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(opt.id)}
                disabled={busy}
                className={`min-h-12 rounded-2xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 ${
                  on
                    ? "border-teal-500 bg-teal-50 text-teal-950 dark:bg-teal-950/40 dark:text-teal-50"
                    : "border-border bg-card text-foreground hover:bg-muted/60"
                }`}
              >
                <span className="block text-[13px] font-semibold">{opt.label}</span>
                <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                  {opt.desc}
                </span>
              </button>
            )
          })}
        </div>

        <label className="mt-3 block">
          <span className="text-[11px] font-medium text-muted-foreground">
            Optional note (short)
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 140))}
            rows={2}
            maxLength={140}
            disabled={busy}
            placeholder="Optional context for your request"
            className="mt-1 w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
          />
        </label>

        {displayError ? (
          <p className="mt-2 text-[12px] font-medium text-rose-600" role="alert">
            {displayError}
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-11 flex-1 rounded-xl border border-border bg-card text-sm font-bold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || selected.length === 0}
            onClick={() => {
              if (selected.length === 0) {
                setLocalError("Select at least one intent")
                return
              }
              onConfirm({
                intents: selected,
                note: note.trim() || undefined,
              })
            }}
            className="min-h-11 flex-1 rounded-xl bg-teal-600 text-sm font-bold text-white transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send request"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConnectionIntentPicker
