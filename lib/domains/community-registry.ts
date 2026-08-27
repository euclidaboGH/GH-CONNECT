/**
 * First-class Community registry — not only Conversation.
 * Chat remains a linked channel (conversationId); Board / events / members live here.
 */

export type CommunityRole = "owner" | "admin" | "moderator" | "member"
export type CommunityPrivacy = "public" | "private" | "invite-only"

export type BoardPostKind = "text" | "image" | "poll" | "question" | "resource"

export interface BoardPost {
  id: string
  communityId: string
  authorId: string
  authorName: string
  authorPhoto?: string
  authorRole?: CommunityRole
  kind: BoardPostKind
  body: string
  imageUrl?: string
  createdAt: number
  likes: number
  likedByMe?: boolean
  commentCount: number
  pinned?: boolean
  pollOptions?: { id: string; text: string; votes: number }[]
}

export interface CommunityEvent {
  id: string
  communityId: string
  title: string
  description?: string
  startsAt: number
  endsAt?: number
  location?: string
  isOnline?: boolean
  rsvpYes: string[]
  createdBy: string
}

export interface CommunityAnnouncement {
  id: string
  communityId: string
  title: string
  body: string
  createdAt: number
  authorId: string
  priority: "normal" | "high"
}

export interface CommunitySettings {
  slowModeSeconds: number
  newMemberCooldownHours: number
  keywordFilters: string[]
  chatMentionsOnlyDefault: boolean
}

export interface GHCCommunity {
  id: string
  name: string
  purpose: string
  description: string
  coverImage?: string
  category: string
  region?: string
  continent?: string
  tags: string[]
  privacy: CommunityPrivacy
  rules: string[]
  welcomeMessage: string
  members: string[]
  roles: Record<string, CommunityRole>
  createdBy: string
  createdAt: number
  /** Linked realtime chat channel id */
  conversationId?: string
  boardPosts: BoardPost[]
  events: CommunityEvent[]
  announcements: CommunityAnnouncement[]
  joinRequests: string[]
  inviteCode?: string
  settings: CommunitySettings
  mutedBy: string[]
  isSample?: boolean
  verified?: boolean
  boardUnread?: number
  chatUnread?: number
  lastActivityAt: number
  stats: {
    membersJoinedThisWeek: number
    postsThisWeek: number
    activeChatApprox: number
  }
}

const STORAGE_KEY = "ghc_communities_v1"
const UID = "current-user"

const DEFAULT_SETTINGS: CommunitySettings = {
  slowModeSeconds: 0,
  newMemberCooldownHours: 1,
  keywordFilters: [],
  chatMentionsOnlyDefault: true,
}

function id(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function seedCommunities(): GHCCommunity[] {
  const now = Date.now()
  const mk = (
    partial: Omit<GHCCommunity, "boardPosts" | "events" | "announcements" | "joinRequests" | "mutedBy" | "settings" | "stats" | "lastActivityAt" | "roles" | "members"> & {
      members?: string[]
      roles?: Record<string, CommunityRole>
      boardPosts?: BoardPost[]
      events?: CommunityEvent[]
    },
  ): GHCCommunity => {
    const members = partial.members || ["demo-mod", "sarah", "emma"]
    const roles: Record<string, CommunityRole> = {
      "demo-mod": "owner",
      ...(partial.roles || {}),
    }
    return {
      purpose: partial.purpose,
      description: partial.description,
      category: partial.category,
      region: partial.region,
      continent: partial.continent,
      tags: partial.tags || [],
      privacy: partial.privacy,
      rules: partial.rules || ["Be respectful", "No spam", "Help newcomers"],
      welcomeMessage: partial.welcomeMessage || `Welcome to ${partial.name}!`,
      coverImage: partial.coverImage,
      isSample: true,
      verified: partial.verified,
      boardUnread: partial.boardUnread,
      chatUnread: partial.chatUnread,
      conversationId: partial.conversationId || partial.id,
      inviteCode: partial.inviteCode,
      id: partial.id,
      name: partial.name,
      createdBy: partial.createdBy || "demo-mod",
      createdAt: partial.createdAt || now - 86400000 * 14,
      members,
      roles,
      boardPosts: partial.boardPosts || [
        {
          id: `bp_${partial.id}_1`,
          communityId: partial.id,
          authorId: "demo-mod",
          authorName: "Moderator",
          authorRole: "owner",
          kind: "text",
          body: partial.welcomeMessage || `Welcome to ${partial.name}. Introduce yourself!`,
          createdAt: now - 3600000,
          likes: 4,
          commentCount: 2,
          pinned: true,
        },
      ],
      events: partial.events || [],
      announcements: [],
      joinRequests: [],
      mutedBy: [],
      settings: { ...DEFAULT_SETTINGS },
      lastActivityAt: now - 1800000,
      stats: {
        membersJoinedThisWeek: 3,
        postsThisWeek: 8,
        activeChatApprox: 5,
      },
    }
  }

  return [
    mk({
      id: "demo-community-lagos-tech",
      name: "Lagos Tech",
      purpose: "Builders and learners in Lagos",
      description: "Jobs, side projects, and mentorship for the Lagos tech scene.",
      category: "Tech",
      region: "Lagos, Nigeria",
      continent: "Africa",
      tags: ["Tech", "Lagos", "Mentorship"],
      privacy: "public",
      rules: ["Be respectful", "No spam job blasts", "Help newcomers"],
      welcomeMessage: "Welcome to Lagos Tech — introduce yourself and read the rules.",
      boardUnread: 3,
      chatUnread: 2,
      events: [
        {
          id: "ev_lagos_1",
          communityId: "demo-community-lagos-tech",
          title: "Weekend builders meetup",
          startsAt: now + 86400000 * 3,
          location: "Yaba, Lagos",
          rsvpYes: ["sarah"],
          createdBy: "demo-mod",
        },
      ],
    }),
    mk({
      id: "demo-community-creators-hub",
      name: "Creators Hub",
      purpose: "Feedback and collaboration for creators",
      description: "Writers, designers, and video creators — share work and ship together.",
      category: "Arts",
      region: "Global",
      continent: "Global",
      tags: ["Creators", "Design", "Content"],
      privacy: "public",
      rules: ["Constructive feedback only", "Credit original work"],
      welcomeMessage: "Glad you are here — pin your portfolio link in the intro thread.",
    }),
    mk({
      id: "demo-community-wellness",
      name: "Wellness Circle",
      purpose: "Fitness, mindfulness, sustainable habits",
      description: "Encourage healthy routines without shame or medical claims.",
      category: "Wellness",
      region: "Global",
      continent: "Global",
      tags: ["Fitness", "Mindfulness"],
      privacy: "public",
      events: [
        {
          id: "ev_well_1",
          communityId: "demo-community-wellness",
          title: "Sunday stretch session",
          startsAt: now + 86400000 * 2,
          isOnline: true,
          rsvpYes: [],
          createdBy: "demo-mod",
        },
      ],
    }),
    mk({
      id: "demo-community-founders",
      name: "Founders & Operators",
      purpose: "Honest ops talk for early-stage teams",
      description: "Early-stage founders and operators — no unsolicited pitching in intros.",
      category: "Business",
      region: "Global",
      continent: "Global",
      tags: ["Startups", "Business"],
      privacy: "public",
      verified: true,
    }),
    mk({
      id: "demo-community-accra-creatives",
      name: "Accra Creatives",
      purpose: "Designers and makers in Greater Accra",
      description: "Designers, photographers and makers — support local talent.",
      category: "Arts",
      region: "Accra, Ghana",
      continent: "Africa",
      tags: ["Accra", "Design", "Local"],
      privacy: "public",
      boardUnread: 2,
      chatUnread: 1,
    }),
  ]
}

export function loadCommunities(): GHCCommunity[] {
  if (typeof window === "undefined") return seedCommunities()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const seeds = seedCommunities()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds))
      return seeds
    }
    const parsed = JSON.parse(raw) as GHCCommunity[]
    if (!Array.isArray(parsed) || parsed.length === 0) return seedCommunities()
    // Ensure seeds still present for discovery
    const ids = new Set(parsed.map((c) => c.id))
    const missing = seedCommunities().filter((s) => !ids.has(s.id))
    return missing.length ? [...parsed, ...missing] : parsed
  } catch {
    return seedCommunities()
  }
}

export function saveCommunities(list: GHCCommunity[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* quota */
  }
}

export function isMember(c: GHCCommunity, userId = UID) {
  return c.members.includes(userId) || c.createdBy === userId
}

export function roleOf(c: GHCCommunity, userId = UID): CommunityRole | "guest" {
  if (c.createdBy === userId) return "owner"
  return c.roles[userId] || (c.members.includes(userId) ? "member" : "guest")
}

export function createCommunityRecord(input: {
  name: string
  purpose?: string
  description?: string
  category?: string
  region?: string
  continent?: string
  tags?: string[]
  privacy?: CommunityPrivacy
  coverImage?: string
  welcomeMessage?: string
  rules?: string[]
}): GHCCommunity {
  const cid = id("comm")
  const now = Date.now()
  const name = input.name.trim()
  const rules =
    input.rules && input.rules.length > 0
      ? input.rules
      : ["Be respectful", "No spam", "Stay on topic"]
  const welcome =
    input.welcomeMessage?.trim() ||
    `Welcome to ${name}! Introduce yourself and read the rules.`
  return {
    id: cid,
    name,
    purpose: (input.purpose || input.description || name).trim(),
    description: (input.description || input.purpose || "").trim(),
    coverImage: input.coverImage,
    category: input.category || "General",
    region: input.region,
    continent: input.continent,
    tags: input.tags || [],
    privacy: input.privacy || "public",
    rules,
    welcomeMessage: welcome,
    members: [UID],
    roles: { [UID]: "owner" },
    createdBy: UID,
    createdAt: now,
    conversationId: cid,
    boardPosts: [
      {
        id: id("bp"),
        communityId: cid,
        authorId: UID,
        authorName: "You",
        authorRole: "owner",
        kind: "text",
        body: welcome,
        createdAt: now,
        likes: 0,
        commentCount: 0,
        pinned: true,
      },
    ],
    events: [],
    announcements: [],
    joinRequests: [],
    inviteCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
    settings: { ...DEFAULT_SETTINGS },
    mutedBy: [],
    isSample: false,
    boardUnread: 0,
    chatUnread: 0,
    lastActivityAt: now,
    stats: { membersJoinedThisWeek: 1, postsThisWeek: 1, activeChatApprox: 1 },
  }
}

export function joinCommunity(list: GHCCommunity[], communityId: string): GHCCommunity[] {
  return list.map((c) => {
    if (c.id !== communityId) return c
    if (c.privacy === "invite-only") {
      if (c.joinRequests.includes(UID) || isMember(c)) return c
      return { ...c, joinRequests: [...c.joinRequests, UID] }
    }
    if (isMember(c)) return c
    return {
      ...c,
      members: [...c.members, UID],
      roles: { ...c.roles, [UID]: "member" as CommunityRole },
      joinRequests: c.joinRequests.filter((id) => id !== UID),
      lastActivityAt: Date.now(),
      stats: {
        ...c.stats,
        membersJoinedThisWeek: c.stats.membersJoinedThisWeek + 1,
      },
    }
  })
}

export function leaveCommunity(list: GHCCommunity[], communityId: string): GHCCommunity[] {
  return list.map((c) => {
    if (c.id !== communityId) return c
    if (c.createdBy === UID) return c // owner cannot leave without transfer
    return {
      ...c,
      members: c.members.filter((m) => m !== UID),
      roles: Object.fromEntries(Object.entries(c.roles).filter(([k]) => k !== UID)),
    }
  })
}

export function muteCommunity(list: GHCCommunity[], communityId: string): GHCCommunity[] {
  return list.map((c) => {
    if (c.id !== communityId) return c
    const muted = c.mutedBy.includes(UID)
    return {
      ...c,
      mutedBy: muted ? c.mutedBy.filter((x) => x !== UID) : [...c.mutedBy, UID],
    }
  })
}

export function addBoardPost(
  list: GHCCommunity[],
  communityId: string,
  body: string,
  kind: BoardPostKind = "text",
  authorName = "You",
): GHCCommunity[] {
  const now = Date.now()
  return list.map((c) => {
    if (c.id !== communityId || !isMember(c)) return c
    const post: BoardPost = {
      id: id("bp"),
      communityId,
      authorId: UID,
      authorName,
      authorRole: roleOf(c) === "guest" ? "member" : (roleOf(c) as CommunityRole),
      kind,
      body: body.trim(),
      createdAt: now,
      likes: 0,
      commentCount: 0,
    }
    return {
      ...c,
      boardPosts: [post, ...c.boardPosts],
      lastActivityAt: now,
      stats: { ...c.stats, postsThisWeek: c.stats.postsThisWeek + 1 },
    }
  })
}

export function addEvent(
  list: GHCCommunity[],
  communityId: string,
  input: { title: string; startsAt: number; location?: string; isOnline?: boolean; description?: string },
): GHCCommunity[] {
  return list.map((c) => {
    if (c.id !== communityId || !isMember(c)) return c
    const ev: CommunityEvent = {
      id: id("ev"),
      communityId,
      title: input.title.trim(),
      description: input.description,
      startsAt: input.startsAt,
      location: input.location,
      isOnline: input.isOnline,
      rsvpYes: [UID],
      createdBy: UID,
    }
    return { ...c, events: [...c.events, ev], lastActivityAt: Date.now() }
  })
}

export function rsvpEvent(list: GHCCommunity[], communityId: string, eventId: string): GHCCommunity[] {
  return list.map((c) => {
    if (c.id !== communityId) return c
    return {
      ...c,
      events: c.events.map((e) => {
        if (e.id !== eventId) return e
        const has = e.rsvpYes.includes(UID)
        return {
          ...e,
          rsvpYes: has ? e.rsvpYes.filter((x) => x !== UID) : [...e.rsvpYes, UID],
        }
      }),
    }
  })
}

export function approveJoinRequest(
  list: GHCCommunity[],
  communityId: string,
  userId: string,
): GHCCommunity[] {
  return list.map((c) => {
    if (c.id !== communityId) return c
    const r = roleOf(c)
    if (r !== "owner" && r !== "admin" && r !== "moderator") return c
    if (!c.joinRequests.includes(userId)) return c
    return {
      ...c,
      members: c.members.includes(userId) ? c.members : [...c.members, userId],
      roles: { ...c.roles, [userId]: "member" as CommunityRole },
      joinRequests: c.joinRequests.filter((id) => id !== userId),
    }
  })
}

export function nextEventLabel(c: GHCCommunity): string | null {
  const upcoming = c.events
    .filter((e) => e.startsAt > Date.now() - 3600000)
    .sort((a, b) => a.startsAt - b.startsAt)[0]
  if (!upcoming) return null
  const d = new Date(upcoming.startsAt)
  const day = d.toLocaleDateString("en-US", { weekday: "short" })
  return `${day} · ${upcoming.title}`
}

export function scoreCommunity(
  c: GHCCommunity,
  profile: { city?: string; country?: string; interests?: string[]; continent?: string },
): number {
  let score = 0
  score += Math.min(20, c.stats.postsThisWeek * 2)
  score += Math.min(15, c.members.length)
  if (c.verified) score += 10
  if (profile.city && c.region?.toLowerCase().includes(profile.city.toLowerCase())) score += 25
  if (profile.country && c.region?.toLowerCase().includes(profile.country.toLowerCase())) score += 12
  if (profile.continent && c.continent === profile.continent) score += 8
  const interests = (profile.interests || []).map((i) => i.toLowerCase())
  for (const t of c.tags) {
    if (interests.some((i) => i.includes(t.toLowerCase()) || t.toLowerCase().includes(i))) score += 10
  }
  if (c.category && interests.some((i) => i.includes(c.category.toLowerCase()))) score += 8
  score += Math.max(0, 10 - (Date.now() - c.lastActivityAt) / 86400000)
  return score
}

export const CATEGORY_PLACEHOLDER: Record<string, string> = {
  Tech: "from-emerald-600 to-teal-600",
  Arts: "from-violet-600 to-fuchsia-600",
  Wellness: "from-sky-500 to-cyan-600",
  Business: "from-amber-600 to-orange-600",
  General: "from-slate-600 to-zinc-600",
  Education: "from-indigo-600 to-blue-600",
  Gaming: "from-rose-600 to-pink-600",
  Music: "from-purple-600 to-violet-600",
  Sports: "from-green-600 to-lime-600",
  Other: "from-stone-600 to-neutral-600",
}

export const RULE_TEMPLATES = [
  ["Be respectful", "No spam or scams", "Stay on topic"],
  ["Assume good intent", "Credit others' work", "No harassment"],
  ["Help newcomers", "No medical claims", "Encourage, don't shame"],
  ["No unsolicited pitching", "Share learnings", "Keep it constructive"],
]
