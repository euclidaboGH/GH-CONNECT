// Community features engine for groups
// Announcements, polls, events, pinned resources, welcome messages, guidelines, recommendations

export type AnnouncementType = "info" | "important" | "celebration" | "maintenance"
export type PollStatus = "active" | "closed" | "archived"
export type EventStatus = "scheduled" | "ongoing" | "ended" | "cancelled"
export type ResourceType = "document" | "link" | "guide" | "template" | "media"

export interface Announcement {
  id: string
  groupId: string
  authorId: string
  title: string
  content: string
  type: AnnouncementType
  createdAt: number
  expiresAt?: number // optional auto-removal
  pinned: boolean
  reactions?: Record<string, string[]> // emoji -> user ids
}

export interface PollOption {
  id: string
  text: string
  votes: number
  votedBy?: string[] // user ids who voted
}

export interface Poll {
  id: string
  groupId: string
  creatorId: string
  question: string
  options: PollOption[]
  status: PollStatus
  createdAt: number
  closesAt: number
  multipleChoice: boolean
  allowedVoters?: string[] // if empty, everyone can vote
  results?: { totalVotes: number; mostPopular?: string }
}

export interface ScheduledEvent {
  id: string
  groupId: string
  creatorId: string
  title: string
  description: string
  startsAt: number
  endsAt: number
  status: EventStatus
  location?: string
  virtualLink?: string
  attendees?: string[] // user ids
  reminders?: { id: string; sendAt: number; sent: boolean }[] // send reminder X mins before
  category?: "meeting" | "social" | "workshop" | "discussion" | "celebration"
}

export interface PinnedResource {
  id: string
  groupId: string
  title: string
  description: string
  resourceType: ResourceType
  url?: string
  content?: string // for inline content
  uploadedBy: string
  uploadedAt: number
  order: number // manual ordering
}

export interface CommunityGuideline {
  id: string
  groupId: string
  title: string
  content: string
  category: "behavior" | "content" | "technical" | "general"
  priority: 1 | 2 | 3 // 1=critical, 2=important, 3=nice-to-know
  createdAt: number
}

export interface WelcomeMessage {
  id: string
  groupId: string
  content: string
  updatedAt: number
  updatedBy: string
  showToNewMembers: boolean
}

export interface GroupRecommendation {
  groupId: string
  reason: "similar-interests" | "friends-joined" | "trending" | "active" | "new"
  confidence: number // 0-1
  relatedToUser?: boolean // if member has similar interests
}

// Utility functions

export function createAnnouncement(
  groupId: string,
  authorId: string,
  title: string,
  content: string,
  type: AnnouncementType = "info",
  expiresIn?: number // milliseconds
): Announcement {
  return {
    id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    groupId,
    authorId,
    title,
    content,
    type,
    createdAt: Date.now(),
    expiresAt: expiresIn ? Date.now() + expiresIn : undefined,
    pinned: false,
  }
}

export function createPoll(
  groupId: string,
  creatorId: string,
  question: string,
  options: string[],
  durationMinutes: number = 60,
  multipleChoice: boolean = false
): Poll {
  const now = Date.now()
  return {
    id: `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    groupId,
    creatorId,
    question,
    options: options.map((text) => ({
      id: `opt_${Math.random().toString(36).substr(2, 9)}`,
      text,
      votes: 0,
    })),
    status: "active",
    createdAt: now,
    closesAt: now + durationMinutes * 60 * 1000,
    multipleChoice,
  }
}

export function createEvent(
  groupId: string,
  creatorId: string,
  title: string,
  description: string,
  startsAt: number,
  endsAt: number,
  category?: "meeting" | "social" | "workshop" | "discussion" | "celebration",
  location?: string,
  virtualLink?: string
): ScheduledEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    groupId,
    creatorId,
    title,
    description,
    startsAt,
    endsAt,
    status: startsAt > Date.now() ? "scheduled" : "ongoing",
    location,
    virtualLink,
    category,
    attendees: [creatorId],
  }
}

export function createPinnedResource(
  groupId: string,
  title: string,
  description: string,
  resourceType: ResourceType,
  uploadedBy: string,
  order: number,
  url?: string,
  content?: string
): PinnedResource {
  return {
    id: `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    groupId,
    title,
    description,
    resourceType,
    uploadedBy,
    uploadedAt: Date.now(),
    order,
    url,
    content,
  }
}

export function addVoteToPoll(poll: Poll, optionId: string, userId: string, multiVote: boolean = false): Poll {
  return {
    ...poll,
    options: poll.options.map((opt) => {
      if (opt.id === optionId) {
        const hasVoted = opt.votedBy?.includes(userId)
        if (hasVoted && !multiVote) {
          // Remove vote (toggle)
          return {
            ...opt,
            votes: opt.votes - 1,
            votedBy: opt.votedBy?.filter((id) => id !== userId) || [],
          }
        } else if (!hasVoted) {
          // Add vote
          return {
            ...opt,
            votes: opt.votes + 1,
            votedBy: [...(opt.votedBy || []), userId],
          }
        }
      }
      return opt
    }),
  }
}

export function closePoll(poll: Poll): Poll {
  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0)
  const mostPopular = poll.options.reduce((prev, current) =>
    current.votes > prev.votes ? current : prev
  )

  return {
    ...poll,
    status: "closed",
    results: {
      totalVotes,
      mostPopular: mostPopular.text,
    },
  }
}

export function attendEvent(event: ScheduledEvent, userId: string): ScheduledEvent {
  const attendees = event.attendees || []
  if (!attendees.includes(userId)) {
    attendees.push(userId)
  }
  return { ...event, attendees }
}

export function unattendEvent(event: ScheduledEvent, userId: string): ScheduledEvent {
  return {
    ...event,
    attendees: event.attendees?.filter((id) => id !== userId) || [],
  }
}

export function updateEventStatus(event: ScheduledEvent): ScheduledEvent {
  const now = Date.now()
  let status: EventStatus = event.status

  if (event.status === "cancelled") {
    status = "cancelled"
  } else if (now < event.startsAt) {
    status = "scheduled"
  } else if (now >= event.startsAt && now < event.endsAt) {
    status = "ongoing"
  } else if (now >= event.endsAt) {
    status = "ended"
  }

  return { ...event, status }
}

export function sortResources(resources: PinnedResource[]): PinnedResource[] {
  return [...resources].sort((a, b) => a.order - b.order)
}

export function reorderResources(
  resources: PinnedResource[],
  fromIndex: number,
  toIndex: number
): PinnedResource[] {
  const updated = [...resources]
  const [moved] = updated.splice(fromIndex, 1)
  updated.splice(toIndex, 0, moved)

  return updated.map((res, idx) => ({ ...res, order: idx }))
}

export function getGroupRecommendations(
  allGroups: Array<{ id: string; category?: string; members: number; onlineMembers?: number }>,
  userInterests: string[],
  joinedGroupIds: string[],
  recentlyJoined?: string[]
): GroupRecommendation[] {
  const recommendations: GroupRecommendation[] = []

  allGroups.forEach((group) => {
    if (joinedGroupIds.includes(group.id)) return

    // Similar interests
    if (userInterests.includes(group.category || "")) {
      recommendations.push({
        groupId: group.id,
        reason: "similar-interests",
        confidence: 0.9,
        relatedToUser: true,
      })
    }

    // Friends joined
    if (recentlyJoined?.includes(group.id)) {
      recommendations.push({
        groupId: group.id,
        reason: "friends-joined",
        confidence: 0.75,
      })
    }

    // Trending
    if (group.onlineMembers && group.onlineMembers > 100) {
      recommendations.push({
        groupId: group.id,
        reason: "trending",
        confidence: (group.onlineMembers || 0) / (group.members || 1) * 0.5,
      })
    }

    // Active
    if (group.members > 500) {
      recommendations.push({
        groupId: group.id,
        reason: "active",
        confidence: 0.6,
      })
    }
  })

  // Sort by confidence and deduplicate
  const deduped = Array.from(
    new Map(
      recommendations.map((rec) => [
        rec.groupId,
        recommendations
          .filter((r) => r.groupId === rec.groupId)
          .reduce((best, current) => (current.confidence > best.confidence ? current : best)),
      ])
    ).values()
  ).sort((a, b) => b.confidence - a.confidence)

  return deduped.slice(0, 10) // Top 10 recommendations
}

export function shouldExpireAnnouncement(announcement: Announcement): boolean {
  if (!announcement.expiresAt) return false
  return Date.now() > announcement.expiresAt
}

export function formatEventDate(event: ScheduledEvent, locale: string = "en-US"): string {
  const start = new Date(event.startsAt)
  const end = new Date(event.endsAt)

  const sameDay = start.toDateString() === end.toDateString()
  const dateStr = start.toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
  const timeStr = start.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
  const endTimeStr = end.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })

  if (sameDay) {
    return `${dateStr}, ${timeStr} - ${endTimeStr}`
  }

  const endDateStr = end.toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
  return `${dateStr} ${timeStr} - ${endDateStr} ${endTimeStr}`
}

export function getUpcomingEvents(events: ScheduledEvent[], limit: number = 5): ScheduledEvent[] {
  const now = Date.now()
  return events
    .filter((e) => e.status !== "cancelled" && e.startsAt > now)
    .sort((a, b) => a.startsAt - b.startsAt)
    .slice(0, limit)
}

export function getActivePolls(polls: Poll[]): Poll[] {
  const now = Date.now()
  return polls.filter((p) => p.status === "active" && p.closesAt > now)
}
