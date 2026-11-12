/** CTA copy hierarchy for Discover / Matches — Interest vs Connect vs Message */

export function primaryRelationshipCta(opts: {
  isFriend: boolean
  isMatch: boolean
  outgoingPending: boolean
  incomingPending: boolean
}): { label: string; action: "message" | "connect" | "accept" | "pending" | "interest" } {
  if (opts.isFriend || opts.isMatch) return { label: "Message", action: "message" }
  if (opts.incomingPending) return { label: "Respond", action: "accept" }
  if (opts.outgoingPending) return { label: "Requested", action: "pending" }
  return { label: "Connect", action: "connect" }
}

export function discoverEmptyAfterFilters(): string {
  return "No people match these filters. Clear filters to see more candidates."
}
