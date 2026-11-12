"use client"

/**
 * Category-specific discovery presentation.
 * Actions only when meaningful; no fake persistence buttons.
 */

import type { DiscoveryCandidate } from "@/lib/domains/contracts/discovery"
import {
  isPersonCandidate,
  isCommunityCandidate,
  isEventCandidate,
  isActivityCandidate,
  isServiceCandidate,
} from "@/lib/domains/contracts/discovery"
import { ConnectionCard } from "./connection-card"
import type { ConnectionUiState } from "@/lib/domains/adapters/connection-graph-adapter"
import type { ConnectionIntentId } from "@/lib/connection-intents"
import { formatReasonsForUi } from "@/lib/domains/adapters/discovery-adapter"
import { ACTION_LABELS, actionAriaLabel } from "@/lib/action-language"
import { WorkflowPathHint } from "@/components/ghc/workflow-path-hint"

export function DiscoveryObjectCard({
  candidate,
  connectionState,
  selectedIntent,
  busy,
  onPersonAction,
  onOpenCommunity,
  onOpenEvent,
  onOpenActivity,
  onOpenService,
}: {
  candidate: DiscoveryCandidate
  connectionState?: ConnectionUiState
  selectedIntent?: ConnectionIntentId | null
  busy?: boolean
  onPersonAction?: (action: string, c: DiscoveryCandidate) => void
  onOpenCommunity?: (id: string) => void
  onOpenEvent?: (id: string, communityId?: string) => void
  onOpenActivity?: (id: string, communityId?: string) => void
  onOpenService?: (id: string) => void
}) {
  if (isPersonCandidate(candidate)) {
    return (
      <ConnectionCard
        candidate={candidate}
        connectionState={connectionState || "none"}
        selectedIntent={selectedIntent}
        busy={busy}
        onAction={(a, c) => onPersonAction?.(a, c)}
      />
    )
  }

  const reason = formatReasonsForUi(candidate, 2)

  if (isCommunityCandidate(candidate)) {
    return (
      <article className="rounded-[1.25rem] border border-border/50 bg-card p-3.5 shadow-[var(--gh-card-shadow)]" aria-label={`Community ${candidate.displayName}`}>
        <h3 className="text-sm font-semibold text-foreground">{candidate.displayName}</h3>
        {candidate.purpose || candidate.subtitle ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{candidate.purpose || candidate.subtitle}</p>
        ) : null}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {candidate.memberCount != null ? `${candidate.memberCount} members` : ""}
          {candidate.region ? ` · ${candidate.region}` : ""}
          {candidate.privacy ? ` · ${candidate.privacy}` : ""}
        </p>
        <p className="mt-2 text-[11px] text-foreground/80"><span className="font-medium text-primary">Why: </span>{reason}</p>
        <WorkflowPathHint kind="community" />
        <div className="mt-3 flex gap-1.5">
          <button type="button" className="min-h-10 rounded-full bg-primary px-3.5 py-2 text-[11px] font-semibold text-primary-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" aria-label={actionAriaLabel(ACTION_LABELS.viewCommunity, candidate.displayName)} onClick={() => onOpenCommunity?.(candidate.id)}>{ACTION_LABELS.viewCommunity}</button>
        </div>
      </article>
    )
  }

  if (isEventCandidate(candidate)) {
    const when = candidate.startsAt ? new Date(candidate.startsAt).toLocaleString() : "Date TBA"
    return (
      <article className="rounded-[1.25rem] border border-border/50 bg-card p-3.5 shadow-[var(--gh-card-shadow)]" aria-label={`Event ${candidate.displayName}`}>
        <h3 className="text-sm font-semibold text-foreground">{candidate.displayName}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{when}</p>
        <p className="text-[11px] text-muted-foreground">
          {candidate.locationLabel || (candidate.isOnline ? "Online" : "")}
          {candidate.communityName ? ` · ${candidate.communityName}` : ""}
        </p>
        <p className="mt-2 text-[11px] text-foreground/80"><span className="font-medium text-primary">Why: </span>{reason}</p>
        <WorkflowPathHint kind="event" />
        <div className="mt-3 flex gap-1.5">
          <button type="button" className="min-h-10 rounded-full border border-border px-3.5 py-2 text-[11px] font-medium transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" aria-label={actionAriaLabel(ACTION_LABELS.viewEvent, candidate.displayName)} onClick={() => onOpenEvent?.(candidate.id, candidate.communityId)}>{ACTION_LABELS.viewEvent}</button>
        </div>
      </article>
    )
  }

  if (isActivityCandidate(candidate)) {
    return (
      <article className="rounded-[1.25rem] border border-border/50 bg-card p-3.5 shadow-[var(--gh-card-shadow)]" aria-label={`Activity ${candidate.displayName}`}>
        <h3 className="text-sm font-semibold text-foreground line-clamp-2">{candidate.displayName}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {candidate.activityType || "Activity"}
          {candidate.communityName ? ` · ${candidate.communityName}` : ""}
          {candidate.organizerName ? ` · ${candidate.organizerName}` : ""}
        </p>
        <p className="mt-2 text-[11px] text-foreground/80"><span className="font-medium text-primary">Why: </span>{reason}</p>
        <WorkflowPathHint kind="activity" />
        <div className="mt-3">
          <button type="button" className="min-h-10 rounded-full border border-border px-3.5 py-2 text-[11px] font-medium transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" aria-label={actionAriaLabel(ACTION_LABELS.viewActivity, candidate.displayName)} onClick={() => onOpenActivity?.(candidate.id, candidate.communityId)}>{ACTION_LABELS.viewActivity}</button>
        </div>
      </article>
    )
  }

  if (isServiceCandidate(candidate)) {
    return (
      <article className="rounded-[1.25rem] border border-border/50 bg-card p-3.5 shadow-[var(--gh-card-shadow)]" aria-label={`Service ${candidate.displayName}`}>
        <h3 className="text-sm font-semibold text-foreground">{candidate.displayName}</h3>
        {candidate.subtitle ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{candidate.subtitle}</p> : null}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {candidate.serviceCategory || "Service"}
          {candidate.priceLabel ? ` · ${candidate.priceLabel}` : ""}
          {candidate.locationLabel ? ` · ${candidate.locationLabel}` : ""}
        </p>
        <p className="mt-2 text-[11px] text-foreground/80"><span className="font-medium text-primary">Why: </span>{reason}</p>
        <WorkflowPathHint kind="service" />
        <div className="mt-3 flex gap-1.5">
          <button type="button" className="min-h-10 rounded-full border border-border px-3.5 py-2 text-[11px] font-medium transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" aria-label={actionAriaLabel(ACTION_LABELS.viewListing, candidate.displayName)} onClick={() => onOpenService?.(candidate.id)}>{ACTION_LABELS.viewListing}</button>
        </div>
      </article>
    )
  }

  return null
}

export default DiscoveryObjectCard
