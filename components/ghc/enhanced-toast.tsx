"use client"

import { X, AlertCircle, CheckCircle, Info } from "lucide-react"

interface EnhancedToastProps {
  message: string
  type: "success" | "error" | "info"
  onClose: () => void
  actionLabel?: string
  onAction?: () => void
}

export function EnhancedToast({ message, type, onClose, actionLabel, onAction }: EnhancedToastProps) {
  const icons = {
    success: <CheckCircle size={20} className="text-emerald-600" aria-hidden />,
    error: <AlertCircle size={20} className="text-destructive" aria-hidden />,
    info: <Info size={20} className="text-sky-600" aria-hidden />,
  }

  const bgClass = {
    success: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900",
    error: "bg-destructive/10 border-destructive/25",
    info: "bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-900",
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-[1rem] border p-3.5 shadow-[var(--gh-card-shadow)] ${bgClass[type]}`}
      role="status"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {icons[type]}
        <span className="text-sm font-medium text-foreground">{message}</span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="whitespace-nowrap text-sm font-semibold text-primary hover:underline"
          >
            {actionLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-muted-foreground transition hover:bg-black/5"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
