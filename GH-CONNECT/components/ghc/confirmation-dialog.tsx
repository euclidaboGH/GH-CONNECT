"use client"

import { AlertCircle } from "lucide-react"

interface ConfirmationDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  isDangerous?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmationDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDangerous,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="fixed inset-0 bg-black/45 backdrop-blur-[1px]" onClick={onCancel} />

      <div role="dialog" aria-modal="true" aria-labelledby="gh-confirmation-title" aria-describedby="gh-confirmation-message" className="gh-premium-dialog relative w-full max-w-md space-y-4 rounded-t-[1.75rem] border border-violet-200/45 bg-card p-5 text-card-foreground shadow-[0_24px_70px_rgba(23,19,59,0.18)] sm:rounded-[1.75rem] sm:p-6">
        <div className="flex items-center gap-3">
          {isDangerous && <AlertCircle size={24} className="text-destructive flex-shrink-0" />}
          <h2 id="gh-confirmation-title" className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
        </div>

        <p id="gh-confirmation-message" className="text-muted-foreground text-sm leading-relaxed">{message}</p>

        <div className="flex gap-3 pt-4">
          <button
            onClick={onCancel}
            className="gh-btn gh-btn-secondary flex-1 min-h-12 rounded-full px-4 py-2 font-bold"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 min-h-12 rounded-full px-4 py-2 text-white font-bold shadow-sm transition active:scale-[0.99] ${
              isDangerous ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
