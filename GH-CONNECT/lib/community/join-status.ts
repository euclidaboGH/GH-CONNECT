/**
 * Phase 6 — honest join CTA labels from privacy + membership state.
 */
export type JoinCtaInput = {
  privacy?: string | null
  viewerIsMember?: boolean
  viewerRole?: string | null
  pendingRequest?: boolean
  isOwner?: boolean
}

export function resolveJoinCta(input: JoinCtaInput): {
  label: string
  disabled: boolean
  action: "none" | "join" | "request" | "leave"
} {
  if (input.isOwner || input.viewerRole === "owner") {
    return { label: "Owner", disabled: true, action: "none" }
  }
  if (input.viewerIsMember) {
    return { label: "Joined", disabled: true, action: "leave" }
  }
  if (input.pendingRequest) {
    return { label: "Request pending", disabled: true, action: "none" }
  }
  const privacy = String(input.privacy || "public").toLowerCase()
  if (privacy === "request" || privacy === "request-only" || privacy === "approval" || privacy === "private") {
    return { label: "Request to join", disabled: false, action: "request" }
  }
  if (privacy === "invite" || privacy === "invite-only") {
    return { label: "Invite only", disabled: true, action: "none" }
  }
  return { label: "Join", disabled: false, action: "join" }
}
