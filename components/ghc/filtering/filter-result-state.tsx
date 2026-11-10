"use client"

import { AlertCircle, LoaderCircle, SearchX } from "lucide-react"

export function FilterResultState({
  state, title, description, onRetry,
}: {
  state: "loading" | "error" | "empty" | "no-results"
  title?: string
  description?: string
  onRetry?: () => void
}) {
  if (state === "loading") return <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status" aria-live="polite"><LoaderCircle size={16} className="animate-spin" aria-hidden />{description || "Loading results…"}</div>
  if (state === "error") return <div className="flex flex-col items-center gap-2 py-8 text-center" role="alert"><AlertCircle size={20} className="text-destructive" aria-hidden /><p className="text-sm font-semibold">{title || "Could not load results"}</p><p className="max-w-sm text-xs text-muted-foreground">{description || "Please try again."}</p>{onRetry ? <button type="button" onClick={onRetry} className="min-h-9 rounded-lg border px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Try again</button> : null}</div>
  return <div className="flex flex-col items-center gap-2 py-8 text-center" role="status"><SearchX size={20} className="text-muted-foreground" aria-hidden /><p className="text-sm font-semibold">{title || (state === "no-results" ? "No matching results" : "Nothing here yet")}</p><p className="max-w-sm text-xs text-muted-foreground">{description || (state === "no-results" ? "Adjust or clear your filters and try again." : "New activity will appear here when available.")}</p></div>
}
