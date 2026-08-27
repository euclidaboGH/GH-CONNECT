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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />

      <div className="relative bg-white rounded-lg shadow-lg max-w-sm w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          {isDangerous && <AlertCircle size={24} className="text-destructive flex-shrink-0" />}
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>

        <p className="text-gray-600 text-sm">{message}</p>

        <div className="flex gap-3 pt-4">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 rounded-lg text-white font-medium transition ${
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
