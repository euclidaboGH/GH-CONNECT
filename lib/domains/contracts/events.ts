/**
 * Events domain contract — preparation foundation for the Coming Soon Events service.
 * This contract does not publish events, create RSVPs, collect payments, or make
 * the Events service available. Those actions require a separately reviewed,
 * server-authoritative implementation and explicit launch approval.
 */
import type { DomainResult, DomainEmptyState } from "./types"

export type EventVisibility = "public" | "community" | "private"
export type EventLifecycle = "draft" | "published" | "cancelled" | "completed"

export interface EventRecord {
  id: string
  organizerId: string
  communityId?: string
  title: string
  description: string
  startsAt: string
  endsAt: string
  timezone: string
  visibility: EventVisibility
  lifecycle: EventLifecycle
  isOnline: boolean
  locationLabel?: string
  meetingUrl?: string
  capacity?: number
  createdAt: string
  updatedAt: string
}

export interface EventsDomainContract {
  listDiscoverable(): DomainResult<EventRecord[]>
  getById(eventId: string): DomainResult<EventRecord>
  emptyState(): DomainEmptyState
}

export function eventsEmptyState(): DomainEmptyState {
  return {
    title: "Events are coming soon",
    description: "GreenHaven is preparing verified event discovery and community event tools. No events or RSVPs are being fabricated.",
    primaryAction: { label: "Explore communities", tab: "communities" },
  }
}
