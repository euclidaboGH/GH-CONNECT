/**
 * User-facing journey guidance. These are suggested routes, not persisted progress
 * or promises that a later action is available or completed.
 */
export type WorkflowPathKind = "community" | "event" | "activity" | "service"

export type WorkflowPathStep = { label: string; detail: string }

const PATHS: Record<WorkflowPathKind, readonly WorkflowPathStep[]> = {
  community: [
    { label: "Explore", detail: "Review the community and its purpose" },
    { label: "Join", detail: "Check its access rules and request or join if available" },
    { label: "Participate", detail: "Take part in its board, polls or activities" },
  ],
  event: [
    { label: "Review", detail: "Check the event details, date and location" },
    { label: "Decide", detail: "Use the event's available participation option" },
    { label: "Follow up", detail: "Return to the event for updates" },
  ],
  activity: [
    { label: "Understand", detail: "Review the activity and its requirements" },
    { label: "Participate", detail: "Continue only if the activity is suitable" },
    { label: "Track", detail: "Check its status and any recorded outcome" },
  ],
  service: [
    { label: "Review", detail: "Check the listing, provider and terms" },
    { label: "Clarify", detail: "Ask the provider questions when messaging is available" },
    { label: "Proceed", detail: "Use the protected order flow when ready" },
  ],
}

export function getWorkflowPath(kind: WorkflowPathKind): readonly WorkflowPathStep[] {
  return PATHS[kind]
}
