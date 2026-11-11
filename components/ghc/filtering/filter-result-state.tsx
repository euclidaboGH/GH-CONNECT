"use client"

import { AlertCircle, LoaderCircle, SearchX } from "lucide-react"

export function FilterResultState({
  state, title, description, onRetry, onClear,
}: {
  state: "loading" | "error" | "empty" | "no-results"
  title?: string
  description?: string
  onRetry?: () => void
  onClear?: () => void
}) {
  if (state === "loading") return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-5" role="status" aria-live="polite">
      <div className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
        <LoaderCircle size={17} className="animate-spin" aria-hidden />
        {description || "Loading results…"}
      </div>
      <div className="mx-auto mt-4 grid max-w-md grid-cols-2 gap-2" aria-hidden>
        <span className="h-2 rounded-full bg-muted" />
        <span className="h-2 rounded-full bg-muted" />
        <span className="col-span-2 h-2 rounded-full bg-muted" />
      </div>
    </div>
  )
  if (state === "error") return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/[0.035] px-4 py-7 text-center" role="alert">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"><AlertCircle size={20} aria-hidden /></span>
      <p className="text-sm font-bold text-foreground">{title || "Could not load results"}</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{description || "Please try again."}</p>
      {onRetry ? <button type="button" onClick={onRetry} className="mt-1 min-h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Try again</button> : null}
    </div>
  )
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/15 px-4 py-8 text-center" role="status" aria-live="polite">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><SearchX size={21} aria-hidden /></span>
      <p className="text-sm font-bold text-foreground">{title || (state === "no-results" ? "No matching results" : "Nothing here yet")}</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{description || (state === "no-results" ? "Adjust or clear your filters and try again." : "New activity will appear here when available.")}</p>
      {state === "no-results" && onClear ? <button type="button" onClick={onClear} className="mt-1 min-h-10 rounded-xl border border-border bg-card px-4 text-xs font-bold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Clear filters</button> : null}
    </div>
  )
}
