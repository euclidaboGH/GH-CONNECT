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
    success: <CheckCircle size={20} className="text-green-500" />,
    error: <AlertCircle size={20} className="text-destructive" />,
    info: <Info size={20} className="text-blue-500" />,
  }

  const bgClass = {
    success: "bg-green-50 border-green-200",
    error: "bg-destructive/10 border-destructive/20",
    info: "bg-blue-50 border-blue-200",
  }

  return (
    <div className={`flex items-center justify-between gap-3 p-4 rounded-lg border ${bgClass[type]} shadow-sm`}>
      <div className="flex items-center gap-3 flex-1">
        {icons[type]}
        <span className="text-sm font-medium text-gray-900">{message}</span>
      </div>

      <div className="flex items-center gap-2">
        {actionLabel && onAction && (
          <button onClick={onAction} className="text-sm font-medium text-primary hover:underline whitespace-nowrap">
            {actionLabel}
          </button>
        )}
        <button onClick={onClose} className="p-1 hover:bg-black/5 rounded transition">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
