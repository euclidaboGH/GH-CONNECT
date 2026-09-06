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
      <article className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm" aria-label={`Community ${candidate.displayName}`}>
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
        <div className="mt-3 flex gap-1.5">
          <button type="button" className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground" onClick={() => onOpenCommunity?.(candidate.id)}>View community</button>
        </div>
      </article>
    )
  }

  if (isEventCandidate(candidate)) {
    const when = candidate.startsAt ? new Date(candidate.startsAt).toLocaleString() : "Date TBA"
    return (
      <article className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm" aria-label={`Event ${candidate.displayName}`}>
        <h3 className="text-sm font-semibold text-foreground">{candidate.displayName}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{when}</p>
        <p className="text-[11px] text-muted-foreground">
          {candidate.locationLabel || (candidate.isOnline ? "Online" : "")}
          {candidate.communityName ? ` · ${candidate.communityName}` : ""}
        </p>
        <p className="mt-2 text-[11px] text-foreground/80"><span className="font-medium text-primary">Why: </span>{reason}</p>
        <div className="mt-3 flex gap-1.5">
          <button type="button" className="rounded-full border border-border px-3 py-1.5 text-[11px] font-medium" onClick={() => onOpenEvent?.(candidate.id, candidate.communityId)}>View event</button>
        </div>
      </article>
    )
  }

  if (isActivityCandidate(candidate)) {
    return (
      <article className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm" aria-label={`Activity ${candidate.displayName}`}>
        <h3 className="text-sm font-semibold text-foreground line-clamp-2">{candidate.displayName}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {candidate.activityType || "Activity"}
          {candidate.communityName ? ` · ${candidate.communityName}` : ""}
          {candidate.organizerName ? ` · ${candidate.organizerName}` : ""}
        </p>
        <p className="mt-2 text-[11px] text-foreground/80"><span className="font-medium text-primary">Why: </span>{reason}</p>
        <div className="mt-3">
          <button type="button" className="rounded-full border border-border px-3 py-1.5 text-[11px] font-medium" onClick={() => onOpenActivity?.(candidate.id, candidate.communityId)}>View activity</button>
        </div>
      </article>
    )
  }

  if (isServiceCandidate(candidate)) {
    return (
      <article className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm" aria-label={`Service ${candidate.displayName}`}>
        <h3 className="text-sm font-semibold text-foreground">{candidate.displayName}</h3>
        {candidate.subtitle ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{candidate.subtitle}</p> : null}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {candidate.serviceCategory || "Service"}
          {candidate.priceLabel ? ` · ${candidate.priceLabel}` : ""}
          {candidate.locationLabel ? ` · ${candidate.locationLabel}` : ""}
        </p>
        <p className="mt-2 text-[11px] text-foreground/80"><span className="font-medium text-primary">Why: </span>{reason}</p>
        <div className="mt-3 flex gap-1.5">
          <button type="button" className="rounded-full border border-border px-3 py-1.5 text-[11px] font-medium" onClick={() => onOpenService?.(candidate.id)}>View listing</button>
        </div>
      </article>
    )
  }

  return null
}

export default DiscoveryObjectCard
