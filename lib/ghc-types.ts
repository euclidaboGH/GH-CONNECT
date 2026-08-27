// GH Connect Types

export type Gender = "male" | "female" | "non-binary" | "prefer-not-to-say"
export type PrimaryMode = "friendship" | "dating" | "networking"
export type Tab = "home" | "discover" | "matches" | "communities" | "messages" | "profile"
export type RelationshipType = "friendship" | "dating" | "networking"
/** Intentional match interest — distinct from friendship/connection */
export type MatchIntention =
  | "dating"
  | "friendship"
  | "professional"
  | "collaboration"
  | "mentorship"
  | "learning"
  | "shared_interests"
export type PrivacyAudience = "everyone" | "matches-only" | "no-one" | "hidden"
export type OnboardingStep = 1 | 2 | 3 | 4 | 5

export type StoryAudience = "everyone" | "followers" | "friends" | "matches-only" | "private"
export type StoryStatus = "draft" | "published" | "expired" | "archived" | "highlight"

export interface StoryItem {
  id: string
  ownerId?: string
  name: string
  photo?: string
  text: string
  media?: { type: "image" | "video"; url: string } | null
  createdAt: number
  /** Lifecycle */
  status?: StoryStatus
  /** Privacy / audience for who may view */
  audience?: StoryAudience
  expiresAt?: number
  archivedAt?: number
  highlightedAt?: number
  /** Engagement (optional session fields) */
  viewIds?: string[]
  reactionCounts?: Record<string, number>
  replyCount?: number
}

export interface Profile {
  displayName: string
  age: number
  gender: Gender
  city: string
  country: string
  /** Structured home/base location (canonical); city/country kept for display & legacy */
  homeLocation?: import("./geography/types").StructuredLocation | null
  currentLocation?: import("./geography/types").StructuredLocation | null
  locationPrivacy?: import("./geography/types").LocationPrivacyLevel
  bio: string
  primaryMode: PrimaryMode
  interests: string[]
  photos: string[] // max 6 base64 or URLs
  coverPhoto: string | null
  status: string // custom status
  profession: string
  bornDate: string
  hometown: string
  education: string
  verified: boolean
  onboarded: boolean
  createdAt: number
  // Profile enhancements - achievements, analytics, social
  skills?: string[]
  pinnedPostIds?: string[]
  socialLinks?: Record<string, string>
  isPublic?: boolean
  profileViews?: number
}

export interface Settings {
  darkMode: boolean
  /** light | dark | system — preferred over darkMode alone */
  themeMode?: "light" | "dark" | "system"
  /** Preset theme id */
  themeId?: string
  /** Optional custom wallpaper (compressed data URL) */
  themeCustomImage?: string | null
  /** Overlay strength for custom image 0–1 */
  themeImageOpacity?: number
  language: string
  onlineStatus: "everyone" | "matches-only" | "hidden"
  whoCanMessage: "everyone" | "matches-only" | "no-one"
  profileVisibility: "everyone" | "matches-only" | "hidden"
  storyVisibility: "everyone" | "matches-only" | "no-one"
  /** Who may see you in Find / discovery */
  whoCanDiscover?: "everyone" | "matches-only" | "no-one"
  /** Who may follow you */
  whoCanFollow?: "everyone" | "matches-only" | "no-one"
  /** Who may send connection requests */
  whoCanConnect?: "everyone" | "matches-only" | "no-one"
  /** Activity / last-seen style signals on profile */
  showActivity?: boolean
  /** Interests visible on public profile */
  showInterests?: boolean
  /** Communities list visible on public profile */
  showCommunities?: boolean
  showLocation: boolean
  locationRadius: number // miles
  ageMin: number
  ageMax: number
  genderPref: string[] // genders interested in
  relationshipType: RelationshipType[]
  blockedUsers: string[]
  /** Soft: hide their content/notifications; relationship kept */
  mutedUsers?: string[]
  /** Soft: limit their interactions toward you; relationship kept */
  restrictedUsers?: string[]
  moderationReports?: Array<{ type: "user" | "post"; targetId: string; reason: string; createdAt: number }>
  /** Notification preferences — device permission still required for push */
  notifyMatches?: boolean
  notifyMessages?: boolean
  notifyRewards?: boolean
  notifyMembership?: boolean
  notifyProfileViews?: boolean
  notifyMarketing?: boolean
}

export interface Post {
  id: string
  authorId: string
  authorName: string
  authorPhoto: string
  content: string
  images: string[] // 1-10 base64/URLs
  video: string | null
  pdf: string | null
  pdfName: string | null
  likes: number
  comments: PostComment[]
  createdAt: number
  // Post editing
  isEdited?: boolean
  editedAt?: number
  editHistory?: Array<{ originalContent: string; editedAt: number; editorId: string; reason?: string }>
  // Enhanced feed features
  isDraft?: boolean
  scheduledFor?: number // timestamp for scheduled posts
  isScheduled?: boolean
  quoteOf?: string // id of quoted post
  hashtags?: string[] // #hashtag references
  mentions?: string[] // @username references
  linkPreview?: LinkPreview | null
  bookmarkedBy?: string[] // user ids who bookmarked
  collections?: string[] // collection names (e.g., "Read Later", "Favorites")
  viewCount?: number
  impressionRank?: number // algorithm rank for "why am I seeing this"
  nativeLanguage?: string
  engagement?: PostEngagementMetrics
  // Marketplace share — canonical listing remains in marketplace domain
  listingId?: string
  listingKind?: "product" | "service" | "opportunity"
  communityId?: string
  communityName?: string
  contentType?: "standard" | "marketplace_listing" | "community_listing"
  // Post action tracking
  hideCount?: number
  hideBy?: string[] // user ids who hid
  notInterestedCount?: number
  notInterestedBy?: string[] // user ids who marked not interested
  reportCount?: number
  reportedBy?: Array<{ userId: string; reason: string }>
  muteCount?: number
  blockCount?: number
  // Sharing metrics
  shares?: number
  copiedCount?: number // times link copied
  // Audience restrictions (canonical)
  /** Who can see this post on the network feed */
  visibility?: "public" | "followers" | "mutuals" | "private"
  /** Legacy alias — prefer `visibility` */
  visibleTo?: "everyone" | "followers" | "matches" | "mutuals" | "private"
}

export interface LinkPreview {
  url: string
  title: string | null
  description: string | null
  image: string | null
  domain: string
}

export interface PostEngagementMetrics {
  likes: number
  comments: number
  shares: number
  views: number
  saves: number
  clicks: number
  avgEngagementTime: number // milliseconds
}

export interface PostComment {
  id: string
  authorName: string
  authorPhoto: string
  authorId?: string
  text: string
  createdAt: number
  // Enhanced features - nested replies & threading
  replyCount?: number
  replies?: PostComment[]
  replyTo?: string // id of parent comment
  threadDepth?: number // nesting level (0-10)
  hasNestedReplies?: boolean
  // Reactions with counts
  reactions?: Record<string, string[]> // emoji -> user ids
  reactionCounts?: Record<string, number> // emoji -> count
  // Editing & history
  isPinned?: boolean
  isEdited?: boolean
  editedAt?: number
  editedBy?: string
  // Media attachments (images, GIFs, voice)
  mediaAttachments?: Array<{
    id: string
    type: "image" | "gif" | "voice"
    url: string
    duration?: number // seconds for voice
    thumbnail?: string
    size?: number // bytes
    mimeType?: string
  }>
  // Content extraction
  mentions?: string[] // @username references
  hashtags?: string[] // #hashtag references
}

export interface Candidate {
  id: string
  name: string
  age: number
  location: string
  bio: string
  photo: string
  interests: string[]
  verified: boolean
  online: boolean
  lastSeen: number
}

export interface MatchEntry {
  id: string
  userId: string
  userName: string
  userPhoto: string
  matchedAt: number
  online: boolean
  /** Intentions agreed at match time (optional for legacy matches) */
  intentions?: MatchIntention[]
  /** Short explainable reasons shown to the user (not a guarantee) */
  reasons?: string[]
  qualityScore?: number
}

export interface Like {
  id: string
  fromUserId: string
  toUserId: string
  createdAt: number
}

export interface Conversation {
  id: string
  participantId: string
  participantName: string
  participantPhoto: string
  messages: Message[]
  lastMessage: string
  lastMessageTime: number
  unread: boolean
  online: boolean
  conversationType: "private" | "group"
  // Pinning & archiving
  isPinned?: boolean
  isArchived?: boolean
  // Typing & online status
  isTyping?: boolean
  typingUser?: string
  // Muting
  isMuted?: boolean
  muteUntil?: number // timestamp when mute expires
  // Group features
  groupName?: string
  groupPhoto?: string
  members?: string[]
  groupRoles?: Record<string, "admin" | "member">
  createdBy?: string
  createdAt?: number
  // Enhanced group features
  privacy?: "public" | "private" | "invite-only"
  description?: string
  category?: string
  welcomeMessage?: string
  rules?: string[]
  invitedMembers?: string[]
  // Search & filtering
  lastReadMessageId?: string
  unreadCount?: number
}

export interface Message {
  id: string
  senderId: string
  sharedPostId?: string
  text: string
  createdAt: number
  // Enhanced message features
  isEdited?: boolean
  editedAt?: number
  editedBy?: string
  editHistory?: Array<{ originalText: string; editedAt: number }>
  // Canonical message states (UI must derive from these)
  status?: "sending" | "sent" | "delivered" | "read" | "failed" | "deleted"
  readAt?: number
  readBy?: string[] // user ids who read (for groups)
  failedAt?: number
  failureReason?: string
  deletedAt?: number
  isDeleted?: boolean
  isDeletedForEveryone?: boolean
  // Reactions
  reactions?: Record<string, string[]> // emoji -> user ids
  reactionCounts?: Record<string, number>
  // Replies & forwarding
  replyTo?: string // id of parent message
  replyToPreview?: { senderName: string; text: string }
  forwardedFrom?: string // id of original message
  forwardedBy?: string[]
  // Media & attachments
  mediaAttachments?: Array<{
    id: string
    type: "image" | "file" | "voice" | "video"
    url: string
    duration?: number // seconds for voice/video
    size?: number // bytes
    mimeType?: string
    fileName?: string // for files
    waveform?: number[] // audio waveform for voice notes
    thumbnail?: string
  }>
  // Message metadata
  isForwarded?: boolean
  isPinned?: boolean
  isDeletedForEveryone?: boolean
  canDelete?: boolean // current user can delete
  canEdit?: boolean // current user can edit
  // Scheduling & expiration
  scheduledFor?: number // timestamp for scheduled messages
  expiresAt?: number // disappearing message expiration
  expiresIn?: number // seconds until expiration
  // Mentions & tags
  mentions?: string[] // @username references
  tags?: string[] // e.g., #important
}

export interface FriendRequest {
  id: string
  fromUserId: string
  fromUserName: string
  fromUserPhoto: string
  createdAt: number
}

// Enhanced feed features
/** Canonical feed modes (+ legacy nearby/latest kept for compatibility) */
export type FeedFilter =
  | "for-you"
  | "following"
  | "friends"
  | "communities"
  | "trending"
  | "nearby"
  | "latest"

export interface PostReaction {
  type:
    | "like"
    | "love"
    | "laugh"
    | "wow"
    | "sad"
    | "angry"
    | "support"
    | "inspire"
    | "insight"
    | "celebrate"
  emoji: string
  label: string
}

export interface PostVisibilityReason {
  reason: string // "You liked similar posts", "Popular in your network", etc.
  category:
    | "engagement"
    | "network"
    | "interest"
    | "trending"
    | "recency"
    | "personalization"
    | "following"
    | "friends"
    | "community"
    | "inspiration"
    | "nearby"
    | "location"
    | "intention"
    | "contribution"
    | "error"
  /** Optional short label for chip UI */
  shortLabel?: string
}

export interface SavedPost {
  postId: string
  savedAt: number
  collection?: string // "Read Later", "Favorites", etc.
}

export interface PostDraft {
  id: string
  content: string
  images: string[]
  video: string | null
  hashtags: string[]
  mentions: string[]
  createdAt: number
  lastEditedAt: number
}

export interface Toast {
  id: string
  message: string
  type: "success" | "error" | "info"
}
