"use client"

/**
 * Multi-step community join onboarding (pre-membership).
 * Step 1: Why join (optional multi-select)
 * Step 2: Rules acknowledgment (required)
 * Confirm → parent runs authoritative join.
 */

import { useEffect, useId, useRef, useState } from "react"
import { Check, ChevronLeft, X } from "lucide-react"
import {
  COMMUNITY_JOIN_REASON_OPTIONS,
  type CommunityJoinReasonId,
} from "@/lib/domains/contracts/communities"

export interface CommunityJoinReasonPickerProps {
  open: boolean
  communityName?: string
  rules?: string[]
  busy?: boolean
  error?: string | null
  onConfirm: (reasons: CommunityJoinReasonId[]) => void
  onCancel: () => void
}

type Step = "reasons" | "rules"

const DEFAULT_RULES = [
  "Be respectful and constructive.",
  "No spam, scams, or harassment.",
  "Protect privacy — do not share others' personal data.",
  "Stay on topic for this community.",
]

export function CommunityJoinReasonPicker({
  open,
  communityName,
  rules = [],
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: CommunityJoinReasonPickerProps) {
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<Step>("reasons")
  const [selected, setSelected] = useState<CommunityJoinReasonId[]>([])
  const [rulesAck, setRulesAck] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const displayRules = (rules && rules.length > 0 ? rules : DEFAULT_RULES).slice(0, 8)

  useEffect(() => {
    if (!open) return
    setStep("reasons")
    setSelected([])
    setRulesAck(false)
    setLocalError(null)
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>("button, [href], input")?.focus()
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
    }
  }, [open, busy, onCancel])

  if (!open) return null

  const displayError = error || localError

  const toggle = (id: CommunityJoinReasonId) => {
    setLocalError(null)
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const goNext = () => {
    setLocalError(null)
    setStep("rules")
  }

  const submit = () => {
    if (!rulesAck) {
      setLocalError("Please confirm you have read the community rules.")
      return
    }
    onConfirm(selected)
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
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
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-background p-4 shadow-2xl sm:rounded-3xl"
      >
        {/* Progress */}
        <div className="mb-3 flex items-center gap-2" aria-hidden>
          <div className={`h-1 flex-1 rounded-full ${step === "reasons" ? "bg-emerald-500" : "bg-emerald-500"}`} />
          <div className={`h-1 flex-1 rounded-full ${step === "rules" ? "bg-emerald-500" : "bg-muted"}`} />
        </div>

        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              {step === "reasons" ? "Step 1 of 2" : "Step 2 of 2"}
            </p>
            <h2 id={titleId} className="text-base font-bold text-foreground">
              {step === "reasons" ? "Why are you joining?" : "Community guidelines"}
            </h2>
            <p id={descId} className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              {step === "reasons"
                ? communityName
                  ? `Optional — helps ${communityName} understand how you want to participate.`
                  : "Optional — helps members understand how you want to participate."
                : communityName
                  ? `Please review the rules for ${communityName} before joining.`
                  : "Please review the rules before joining."}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {step === "reasons" ? (
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Join reasons">
            {COMMUNITY_JOIN_REASON_OPTIONS.map((opt) => {
              const on = selected.includes(opt.id)
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={on}
                  disabled={busy}
                  onClick={() => toggle(opt.id)}
                  className={`min-h-[4.5rem] rounded-2xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 ${
                    on
                      ? "border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-50"
                      : "border-border bg-card hover:bg-muted/60"
                  }`}
                >
                  <span className="flex items-start gap-1.5">
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        on ? "border-emerald-600 bg-emerald-600 text-white" : "border-muted-foreground/40"
                      }`}
                      aria-hidden
                    >
                      {on ? <Check size={10} strokeWidth={3} /> : null}
                    </span>
                    <span>
                      <span className="block text-[12px] font-bold leading-tight">{opt.label}</span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                        {opt.description}
                      </span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <ul className="space-y-2 rounded-2xl border border-border bg-muted/30 p-3">
              {displayRules.map((r, i) => (
                <li key={i} className="flex gap-2 text-[12px] leading-snug text-foreground">
                  <span className="font-bold text-emerald-600" aria-hidden>
                    {i + 1}.
                  </span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card p-3">
              <input
                type="checkbox"
                checked={rulesAck}
                disabled={busy}
                onChange={(e) => {
                  setRulesAck(e.target.checked)
                  setLocalError(null)
                }}
                className="mt-0.5 h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-[12px] leading-snug text-foreground">
                I have read and agree to follow these community guidelines.
              </span>
            </label>
          </div>
        )}

        {displayError ? (
          <p className="mt-3 text-[12px] font-medium text-destructive" role="alert">
            {displayError}
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          {step === "rules" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setStep("reasons")}
              className="flex min-h-11 items-center justify-center gap-1 rounded-2xl border border-border px-3 text-sm font-bold text-foreground disabled:opacity-50"
            >
              <ChevronLeft size={16} />
              Back
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="min-h-11 flex-1 rounded-2xl border border-border px-3 text-sm font-bold text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          {step === "reasons" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={goNext}
                className="min-h-11 flex-[1.2] rounded-2xl border border-border bg-muted/50 px-3 text-sm font-bold text-foreground disabled:opacity-50"
              >
                Skip
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={goNext}
                className="min-h-11 flex-[1.5] rounded-2xl bg-emerald-600 px-3 text-sm font-bold text-white disabled:opacity-50"
              >
                Continue
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy || !rulesAck}
              onClick={submit}
              className="min-h-11 flex-1 rounded-2xl bg-emerald-600 px-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? "Joining…" : "Agree & join"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
