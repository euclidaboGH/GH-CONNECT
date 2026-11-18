"use client"

/**
 * Shared loading / empty / error / retry presentation.
 * Presentation only — does not fetch data or change business rules.
 */

import type { ReactNode } from "react"
import { AlertCircle, Loader2, RefreshCw } from "lucide-react"
import { buttonClass, typeClass, surfaceClass } from "@/lib/design-system"

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className={`${typeClass.meta} px-0.5 font-bold uppercase tracking-wide text-muted-foreground`}>
      {children}
    </p>
  )
}

export function LoadingBlock({
  label = "Loading…",
  className = "",
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 px-6 py-12 text-center ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-7 w-7 animate-spin text-emerald-600" aria-hidden />
      <p className={`${typeClass.body} text-muted-foreground`}>{label}</p>
    </div>
  )
}

export function ErrorRetryPanel({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Retry",
  className = "",
}: {
  title?: string
  message?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}) {
  return (
    <div
      className={`mx-3 my-3 flex flex-col items-stretch gap-3 rounded-[var(--gh-radius-md)] border border-border bg-card px-4 py-5 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className={`${typeClass.title} text-sm`}>{title}</p>
          {message ? (
            <p className={`mt-1 ${typeClass.body} text-muted-foreground`}>{message}</p>
          ) : null}
        </div>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={`${buttonClass.secondary} min-h-11 w-full gap-2`}
        >
          <RefreshCw size={16} aria-hidden />
          {retryLabel}
        </button>
      ) : null}
    </div>
  )
}

export function InlineRetryBanner({
  message,
  onRetry,
  retryLabel = "Retry",
}: {
  message: string
  onRetry?: () => void
  retryLabel?: string
}) {
  return (
    <div
      className={`mx-3 mt-2 flex items-start gap-2 rounded-[var(--gh-radius-md)] border border-amber-200/80 bg-amber-50 px-3 py-2.5 dark:border-amber-900 dark:bg-amber-950/40 ${surfaceClass.card}`}
      role="status"
    >
      <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-700" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-100">{message}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1.5 text-[11px] font-bold text-amber-900 underline underline-offset-2 dark:text-amber-100"
          >
            {retryLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** Primary CTA busy wrapper styles — presentation only */
export function primaryCtaClass(busy?: boolean) {
  return `${buttonClass.primary} min-h-11 w-full gap-2 disabled:pointer-events-none disabled:opacity-60 ${
    busy ? "cursor-wait" : ""
  }`
}

export function secondaryCtaClass(busy?: boolean) {
  return `${buttonClass.secondary} min-h-11 w-full gap-2 disabled:pointer-events-none disabled:opacity-60 ${
    busy ? "cursor-wait" : ""
  }`
}
