import { ArrowRight } from "lucide-react"
import { getWorkflowPath, type WorkflowPathKind } from "@/lib/workflow-paths"

/** A compact suggested journey; it never represents completed user progress. */
export function WorkflowPathHint({ kind }: { kind: WorkflowPathKind }) {
  const steps = getWorkflowPath(kind)
  return (
    <div className="mt-3 rounded-xl border border-border/50 bg-muted/20 px-2.5 py-2" aria-label="Suggested next steps">
      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">A simple way forward</p>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {steps.map((step, index) => (
          <li key={step.label} className="flex min-w-0 items-center gap-1 text-[10px] font-semibold text-foreground/85">
            {index > 0 ? <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden /> : null}
            <span title={step.detail}>{step.label}</span>
          </li>
        ))}
      </ol>
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{steps[0].detail}</p>
    </div>
  )
}
