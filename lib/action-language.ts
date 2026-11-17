/**
 * Shared interaction language for high-frequency GreenHaven actions.
 * Presentation only: this does not authorize or mutate server state.
 */
export const ACTION_LABELS = {
  viewCommunity: "View community",
  viewEvent: "View event",
  viewActivity: "View activity",
  viewListing: "View listing",
  open: "Open",
  continue: "Continue",
  retry: "Try again",
} as const

export function actionAriaLabel(action: string, subject?: string): string {
  const clean = String(subject || "").trim()
  return clean ? `${action}: ${clean}` : action
}
