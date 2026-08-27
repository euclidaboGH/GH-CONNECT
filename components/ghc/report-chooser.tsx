"use client"

/**
 * Universal Report Chooser — roadmap §21
 * Supports: user | post | comment | message | story | group
 * Optional post-report "Block this user?" for user targets.
 */

import { Flag, X, Ban } from "lucide-react"
import { useState } from "react"

export type ReportTargetType = "user" | "post" | "comment" | "message" | "story" | "group"

export const REPORT_REASONS = [
  "Spam",
  "Harassment",
  "Hate speech",
  "Inappropriate content",
  "Fake profile",
  "Scam / fraud",
  "Other",
] as const

const TARGET_LABELS: Record<ReportTargetType, string> = {
  user: "user",
  post: "post",
  comment: "comment",
  message: "message",
  story: "story",
  group: "community",
}

export function ReportChooser({
  label = "Report",
  targetType = "post",
  targetId,
  onSubmit,
  onBlockAfterReport,
  compact = false,
}: {
  label?: string
  targetType?: ReportTargetType
  targetId?: string
  onSubmit: (reason: string, targetType?: ReportTargetType, details?: string) => void
  onBlockAfterReport?: () => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [details, setDetails] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const submit = () => {
    if (!reason) return
    onSubmit(reason, targetType, details.trim() || undefined)
    setSubmitted(true)
    if (!(targetType === "user" && onBlockAfterReport)) {
      setReason("")
      setDetails("")
      setOpen(false)
      setSubmitted(false)
    }
  }

  const close = () => {
    setOpen(false)
    setReason("")
    setDetails("")
    setSubmitted(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-red-600"
            : "inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-red-600"
        }
      >
        <Flag size={14} aria-hidden="true" />
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end bg-black/40 p-4 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={`Report ${TARGET_LABELS[targetType]}`}
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
            {!submitted ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      Report this {TARGET_LABELS[targetType]}
                    </h2>
                    <p className="mt-1 text-xs text-gray-500">Help keep GH Connect safe for everyone.</p>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Close"
                    className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="max-h-52 space-y-2 overflow-y-auto">
                  {REPORT_REASONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setReason(item)}
                      className={`w-full rounded-xl border px-3 py-3 text-left text-sm font-medium transition ${
                        reason === item
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                {reason && (
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-semibold text-gray-600">
                      Additional details (optional)
                    </label>
                    <textarea
                      value={details}
                      onChange={(e) => setDetails(e.target.value.slice(0, 500))}
                      rows={2}
                      placeholder="Help us understand the issue…"
                      className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                    />
                  </div>
                )}
                <button
                  type="button"
                  disabled={!reason}
                  onClick={submit}
                  className="mt-4 w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Submit report
                </button>
              </>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-bold text-gray-900">Report submitted</h2>
                  <button type="button" onClick={close} aria-label="Close" className="rounded-full p-2 text-gray-500 hover:bg-gray-100">
                    <X size={18} />
                  </button>
                </div>
                <p className="text-sm text-gray-600">
                  Thank you. Our team will review this {TARGET_LABELS[targetType]}.
                </p>
                {targetType === "user" && onBlockAfterReport && (
                  <button
                    type="button"
                    onClick={() => {
                      onBlockAfterReport()
                      close()
                    }}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100"
                  >
                    <Ban size={16} />
                    Also block this user
                  </button>
                )}
                <button
                  type="button"
                  onClick={close}
                  className="mt-2 w-full rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-800"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
