// Community Features for Chat Enhancements
// All features are optional and backward-compatible with existing groups

export interface CommunityAnnouncement {
  id: string
  groupId: string
  authorId: string
  authorName: string
  title: string
  content: string
  priority: "low" | "medium" | "high"
  createdAt: number
  expiresAt?: number // optional expiration
  readBy?: string[] // user ids who read it
}

export interface CommunityPoll {
  id: string
  groupId: string
  authorId: string
  question: string
  options: PollOption[]
  status: "active" | "closed"
  createdAt: number
  expiresAt?: number
  allowMultiple: boolean
  voters?: string[] // user ids who voted
}

export interface PollOption {
  id: string
  text: string
  votes: number
  votedBy?: string[] // user ids
}

export interface ScheduledEvent {
  id: string
  groupId: string
  authorId: string
  authorName: string
  title: string
  description: string
  startTime: number
  endTime: number
  location?: string
  eventType: "meetup" | "discussion" | "workshop" | "social" | "other"
  attendees?: string[] // user ids
  attendeeCount?: number
}

export interface PinnedResource {
  id: string
  groupId: string
  type: "link" | "file" | "image" | "video" | "note"
  title: string
  content: string
  url?: string
  authorId: string
  authorName: string
  pinnedAt: number
  priority: number // lower = higher priority (0 is top)
}

export interface CommunityGuidelines {
  id: string
  groupId: string
  rules: Rule[]
  codeOfConduct?: string
  createdAt: number
  lastUpdated: number
  createdBy: string
}

export interface Rule {
  id: string
  title: string
  description: string
  severity: "warning" | "mute" | "kick" | "ban"
}

export interface WelcomeMessage {
  id: string
  groupId: string
  content: string
  createdAt: number
  createdBy: string
  showsOnJoin: boolean
  hasVideo?: boolean
  videoUrl?: string
}

export interface GroupRecommendation {
  id: string
  targetUserId: string
  groupId: string
  groupName: string
  groupDescription: string
  groupIcon: string
  reason: string // "Friends in group", "Your interests", etc.
  score: number // 0-100
  createdAt: number
}

export interface CommunityFeatureState {
  announcements: CommunityAnnouncement[]
  polls: CommunityPoll[]
  events: ScheduledEvent[]
  pinnedResources: PinnedResource[]
  guidelines: CommunityGuidelines[]
  welcomeMessages: WelcomeMessage[]
  recommendations: GroupRecommendation[]
}

// Feature flags to control optional features
export interface CommunityFeatureFlags {
  enableAnnouncements: boolean
  enablePolls: boolean
  enableEvents: boolean
  enablePinnedResources: boolean
  enableGuidelines: boolean
  enableWelcomeMessages: boolean
  enableRecommendations: boolean
}

export const DEFAULT_FEATURE_FLAGS: CommunityFeatureFlags = {
  enableAnnouncements: true,
  enablePolls: true,
  enableEvents: true,
  enablePinnedResources: true,
  enableGuidelines: true,
  enableWelcomeMessages: true,
  enableRecommendations: true,
}
