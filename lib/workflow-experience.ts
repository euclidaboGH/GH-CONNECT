/**
 * Shared language for multi-step GreenHaven workflows.
 * Presentation only: it never authorizes, mutates, or infers server state.
 */
export type WorkflowStatus = "idle" | "pending" | "success" | "error" | "info"

export type WorkflowFeedback = {
  status: WorkflowStatus
  message?: string
  nextStep?: string
}

export function workflowFeedback(
  status: WorkflowStatus,
  message: string,
  nextStep?: string,
): WorkflowFeedback {
  return { status, message, nextStep }
}

export function workflowStatusLabel(status: WorkflowStatus): string {
  switch (status) {
    case "pending": return "In progress"
    case "success": return "Completed"
    case "error": return "Needs attention"
    case "info": return "Next step"
    default: return "Ready"
  }
}
