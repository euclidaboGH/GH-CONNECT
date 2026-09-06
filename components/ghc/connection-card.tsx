"use client"

/**
 * Standardized Connection Card — identity, explainable relevance, state, actions.
 * Does not invent relationship success; actions only when eligible.
 */

import type { DiscoveryCandidate } from "@/lib/domains/contracts/discovery"
import {
  eligibleConnectionActions,
  connectionStateLabel,
  type ConnectionUiState,
  type ConnectionCardAction,
} from "@/lib/domains/adapters/connection-graph-adapter"
import type { ConnectionIntentId } from "@/lib/connection-intents"
import { formatReasonsForUi } from "@/lib/domains/adapters/discovery-adapter"

export interface ConnectionCardProps {
  candidate: DiscoveryCandidate
  connectionState?: ConnectionUiState
  selectedIntent?: ConnectionIntentId | null
  busy?: boolean
  onAction?: (action: ConnectionCardAction, candidate: DiscoveryCandidate) => void
}

export function ConnectionCard({
  candidate,
  connectionState = "none",
  selectedIntent,
  busy,
  onAction,
}: ConnectionCardProps) {
  const actions = eligibleConnectionActions(connectionState)
  const reasonText = formatReasonsForUi(candidate, 2)
  const stateLabel = connectionStateLabel(connectionState)
  const initials = (candidate.displayName || "M").slice(0, 1).toUpperCase()

  return (
    <article
      className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm"
      aria-label={`${candidate.displayName}, ${stateLabel}`}
      data-connection-state={connectionState}
    >
      <div className="flex gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950">
          {candidate.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={candidate.avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-bold text-emerald-800 dark:text-emerald-200">
              {initials}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {candidate.displayName}
            </h3>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {stateLabel}
            </span>
          </div>
          {candidate.subtitle ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{candidate.subtitle}</p>
          ) : null}
          {candidate.locationLabel ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground/90">{candidate.locationLabel}</p>
          ) : null}
        </div>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-foreground/80">
        <span className="font-medium text-primary">Why: </span>
        {reasonText}
      </p>

      {(candidate.interests && candidate.interests.length > 0) || selectedIntent ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {selectedIntent ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              Intent: {selectedIntent}
            </span>
          ) : null}
          {(candidate.interests || []).slice(0, 4).map((i) => (
            <span
              key={i}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {i}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            disabled={busy || connectionState === "blocked"}
            onClick={() => onAction?.(action, candidate)}
            className={
              action === "connect" || action === "accept"
                ? "rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
                : "rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-foreground disabled:opacity-50"
            }
          >
            {labelForAction(action)}
          </button>
        ))}
      </div>
    </article>
  )
}

function labelForAction(action: ConnectionCardAction): string {
  switch (action) {
    case "connect":
      return "Connect"
    case "accept":
      return "Accept"
    case "decline":
      return "Decline"
    case "message":
      return "Message"
    case "view_profile":
      return "View profile"
    case "invite":
      return "Invite"
    case "save":
      return "Save"
    default:
      return action
  }
}

export default ConnectionCard
