// Community Features for Groups - Optional extensions to Chat
// All features are opt-in and compatible with existing groups

export type AnnouncementPriority = "low" | "normal" | "high"
export type PollStatus = "active" | "closed"
export type EventStatus = "upcoming" | "ongoing" | "completed"
export type ResourceType = "link" | "document" | "image" | "video"

// Announcement feature - pinned important group messages
export interface Announcement {
  id: string
  groupId: string
  authorId: string
  authorName: string
  title: string
  content: string
  priority: AnnouncementPriority
  createdAt: number
  expiresAt?: number // optional expiration
  isPinned: boolean
  views: number
  viewedBy: string[] // user ids
}

// Poll feature - community engagement
export interface Poll {
  id: string
  groupId: string
  authorId: string
  authorName: string
  question: string
  options: PollOption[]
  status: PollStatus
  createdAt: number
  endsAt: number
  totalVotes: number
  allowMultiple: boolean
  showResults: boolean
}

export interface PollOption {
  id: string
  text: string
  votes: number
  votedBy: string[] // user ids
}

// Event feature - scheduled group activities
export interface ScheduledEvent {
  id: string
  groupId: string
  authorId: string
  authorName: string
  title: string
  description: string
  startTime: number
  endTime: number
  status: EventStatus
  location?: string
  isVirtual: boolean
  attendees: string[] // user ids
  rsvpCount: { yes: number; maybe: number; no: number }
  imageUrl?: string
  createdAt: number
}

// Pinned resource - quick access to group info
export interface PinnedResource {
  id: string
  groupId: string
  title: string
  description: string
  resourceType: ResourceType
  url?: string
  content?: string
  imageUrl?: string
  addedBy: string
  addedAt: number
  order: number // for sorting
}

// Welcome message - greeting for new members
export interface WelcomeMessage {
  id: string
  groupId: string
  message: string
  imageUrl?: string
  updatedAt: number
  updatedBy: string
}

// Community guidelines - group rules
export interface CommunityGuidelines {
  id: string
  groupId: string
  title: string
  sections: GuidelineSection[]
  updatedAt: number
  updatedBy: string
  acknowledgmentRequired: boolean
}

export interface GuidelineSection {
  id: string
  title: string
  rules: string[]
  priority: "info" | "warning" | "critical"
}

// Group recommendation - suggest related groups
export interface GroupRecommendation {
  id: string
  recommendedGroupId: string
  groupName: string
  description: string
  category: string
  members: number
  similarity: number // 0-1 score
  reason: string // why recommended
}

// Community stats - engagement metrics
export interface CommunityStats {
  groupId: string
  totalMessages: number
  dailyActiveUsers: number
  weeklyActiveUsers: number
  monthlyActiveUsers: number
  engagementRate: number // 0-1
  averageMessagesPerDay: number
  peakActivityTime: string // "09:00-10:00" format
  lastUpdated: number
}

// Moderation action - track community management
export interface ModerationAction {
  id: string
  groupId: string
  actionType: "warn" | "mute" | "remove" | "ban"
  targetUserId: string
  targetUserName: string
  actionBy: string
  reason: string
  duration?: number // ms for temporary actions
  createdAt: number
  resolvedAt?: number
}

// Helper functions for community features

export function createAnnouncement(
  groupId: string,
  authorId: string,
  authorName: string,
  title: string,
  content: string,
  priority: AnnouncementPriority = "normal"
): Announcement {
  return {
    id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    groupId,
    authorId,
    authorName,
    title,
    content,
    priority,
    createdAt: Date.now(),
    isPinned: false,
    views: 0,
    viewedBy: [],
  }
}

export function createPoll(
  groupId: string,
  authorId: string,
  authorName: string,
  question: string,
  options: string[],
  durationMs: number = 86400000 // 24 hours
): Poll {
  return {
    id: `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    groupId,
    authorId,
    authorName,
    question,
    options: options.map((text, idx) => ({
      id: `opt_${idx}`,
      text,
      votes: 0,
      votedBy: [],
    })),
    status: "active",
    createdAt: Date.now(),
    endsAt: Date.now() + durationMs,
    totalVotes: 0,
    allowMultiple: false,
    showResults: true,
  }
}

export function createScheduledEvent(
  groupId: string,
  authorId: string,
  authorName: string,
  title: string,
  description: string,
  startTime: number,
  endTime: number,
  isVirtual: boolean = true
): ScheduledEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    groupId,
    authorId,
    authorName,
    title,
    description,
    startTime,
    endTime,
    status: startTime > Date.now() ? "upcoming" : "ongoing",
    isVirtual,
    attendees: [authorId],
    rsvpCount: { yes: 1, maybe: 0, no: 0 },
    createdAt: Date.now(),
  }
}

export function createPinnedResource(
  groupId: string,
  title: string,
  description: string,
  resourceType: ResourceType,
  addedBy: string,
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
    url,
    content,
    addedBy,
    addedAt: Date.now(),
    order,
  }
}

export function createWelcomeMessage(
  groupId: string,
  message: string,
  updatedBy: string,
  imageUrl?: string
): WelcomeMessage {
  return {
    id: `wm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    groupId,
    message,
    imageUrl,
    updatedAt: Date.now(),
    updatedBy,
  }
}

export function createCommunityGuidelines(
  groupId: string,
  title: string,
  updatedBy: string
): CommunityGuidelines {
  return {
    id: `cg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    groupId,
    title,
    sections: [],
    updatedAt: Date.now(),
    updatedBy,
    acknowledgmentRequired: true,
  }
}

export function addVoteToPoll(poll: Poll, optionId: string, userId: string): Poll {
  const option = poll.options.find(o => o.id === optionId)
  if (!option) return poll

  // Remove previous vote if not multiple choice
  if (!poll.allowMultiple) {
    poll.options.forEach(o => {
      o.votedBy = o.votedBy.filter(id => id !== userId)
      o.votes = o.votedBy.length
    })
  }

  // Add new vote
  if (!option.votedBy.includes(userId)) {
    option.votedBy.push(userId)
    option.votes = option.votedBy.length
    poll.totalVotes++
  }

  return poll
}

export function rsvpEvent(event: ScheduledEvent, userId: string, status: "yes" | "maybe" | "no"): ScheduledEvent {
  // Remove previous RSVP if exists
  if (event.attendees.includes(userId)) {
    event.attendees = event.attendees.filter(id => id !== userId)
  }

  // Add new RSVP
  if (status !== "no") {
    event.attendees.push(userId)
  }

  // Update counts (simplified)
  event.rsvpCount[status]++

  return event
}

export function closeEvent(event: ScheduledEvent): ScheduledEvent {
  return {
    ...event,
    status: "completed",
  }
}

// Seed community features for demo
export function seedCommunityFeatures() {
  return {
    announcements: [] as Announcement[],
    polls: [] as Poll[],
    events: [] as ScheduledEvent[],
    pinnedResources: [] as PinnedResource[],
    welcomeMessages: {} as Record<string, WelcomeMessage>,
    guidelines: {} as Record<string, CommunityGuidelines>,
    stats: {} as Record<string, CommunityStats>,
  }
}
