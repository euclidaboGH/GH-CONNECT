"use client"

import { CheckCircle2, CircleAlert, Info, Loader2 } from "lucide-react"
import type { WorkflowFeedback as WorkflowFeedbackState } from "@/lib/workflow-experience"
import { workflowStatusLabel } from "@/lib/workflow-experience"

const ICONS = {
  pending: Loader2,
  success: CheckCircle2,
  error: CircleAlert,
  info: Info,
} as const

export function WorkflowFeedback({ state }: { state: WorkflowFeedbackState }) {
  if (state.status === "idle" || !state.message) return null
  const Icon = ICONS[state.status]
  const tone = state.status === "error"
    ? "border-destructive/20 bg-destructive/[0.04] text-destructive"
    : state.status === "success"
      ? "border-primary/20 bg-primary/[0.045] text-primary"
      : "border-border/60 bg-muted/25 text-foreground"

  return (
    <div
      className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs ${tone}`}
      role={state.status === "pending" || state.status === "error" ? "status" : undefined}
      aria-live="polite"
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${state.status === "pending" ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden />
      <span className="min-w-0 flex-1 leading-relaxed">
        <span className="font-bold">{workflowStatusLabel(state.status)} · </span>
        {state.message}
        {state.nextStep ? <span className="block mt-0.5 text-muted-foreground">Next: {state.nextStep}</span> : null}
      </span>
    </div>
  )
}
