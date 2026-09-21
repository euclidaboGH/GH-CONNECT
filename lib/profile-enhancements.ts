// Profile Module Enhancements
// Incremental augmentations for profile completion, analytics, achievements, and social features

import type { Profile, Post } from "@/lib/ghc-types"

// ===== PROFILE COMPLETION TRACKING =====

export interface ProfileCompletionMetrics {
  percentage: number
  missing: string[]
  score: number // 0-100
  level: "beginner" | "intermediate" | "advanced" | "complete"
  nextMilestone: string
  estimatedTimeToComplete: number // minutes
}

export function calculateProfileCompletionMetrics(profile: any): ProfileCompletionMetrics {
  const metrics = {
  displayName: { weight: 10, completed: typeof profile.displayName === "string" && profile.displayName.trim().length > 2 },
  bio: { weight: 15, completed: typeof profile.bio === "string" && profile.bio.trim().length >= 20 },
  photos: { weight: 20, completed: Array.isArray(profile.photos) && typeof profile.photos[0] === "string" && profile.photos[0].trim().length > 0 && !profile.photos[0].includes("placeholder") },
  location: { weight: 10, completed: typeof profile.city === "string" && profile.city.trim().length > 0 && typeof profile.country === "string" && profile.country.trim().length > 0 },
  interests: { weight: 15, completed: Array.isArray(profile.interests) && profile.interests.length >= 3 },
  education: { weight: 10, completed: profile.education && profile.education.length > 0 },
  profession: { weight: 10, completed: profile.profession && profile.profession.length > 0 },
  verified: { weight: 5, completed: profile.verified },
  bornDate: { weight: 5, completed: profile.bornDate && profile.bornDate.length > 0 },
  }

  const missing = Object.entries(metrics)
    .filter(([, m]) => !m.completed)
    .map(([key]) => key)

  const completed = Object.entries(metrics)
    .filter(([, m]) => m.completed)
    .reduce((sum, [, m]) => sum + m.weight, 0)

  const percentage = Math.round(completed)
  const level =
    percentage >= 90
      ? "complete"
      : percentage >= 70
        ? "advanced"
        : percentage >= 40
          ? "intermediate"
          : "beginner"

  const fieldLabels: Record<string, string> = { displayName: "Display name", bio: "Bio (20+ characters)", photos: "Profile photo", location: "City and country", interests: "Interests (3+)", education: "Education", profession: "Profession", verified: "Verification", bornDate: "Birth date" }
  const labeledMissing = missing.map((field) => fieldLabels[field] || field)
  const nextMilestone = labeledMissing.length > 0 ? labeledMissing[0] : "Profile complete!"
  const estimatedTime = missing.length * 3 // ~3 min per missing field

  return {
    percentage,
    missing: labeledMissing,
    score: percentage,
    level,
    nextMilestone,
    estimatedTimeToComplete: estimatedTime,
  }
}

// ===== ACHIEVEMENTS SYSTEM =====

export type AchievementType =
  | "profile_complete"
  | "verified"
  | "10_followers"
  | "100_followers"
  | "first_post"
  | "10_posts"
  | "profile_views_100"
  | "top_post"
  | "social_links"
  | "bio_customization"

export interface Achievement {
  id: AchievementType
  title: string
  description: string
  icon: string
  unlockedAt?: number
  rarity: "common" | "uncommon" | "rare" | "epic"
}

export const ACHIEVEMENTS: Record<AchievementType, Achievement> = {
  profile_complete: {
    id: "profile_complete",
    title: "Complete",
    description: "Fill out all profile fields",
    icon: "✅",
    rarity: "common",
  },
  verified: {
    id: "verified",
    title: "Verified",
    description: "Get account verified",
    icon: "✓",
    rarity: "uncommon",
  },
  "10_followers": {
    id: "10_followers",
    title: "Popular",
    description: "Reach 10 followers",
    icon: "🌟",
    rarity: "uncommon",
  },
  "100_followers": {
    id: "100_followers",
    title: "Influencer",
    description: "Reach 100 followers",
    icon: "⭐",
    rarity: "rare",
  },
  first_post: {
    id: "first_post",
    title: "Debut",
    description: "Create your first post",
    icon: "📝",
    rarity: "common",
  },
  "10_posts": {
    id: "10_posts",
    title: "Creator",
    description: "Create 10 posts",
    icon: "📚",
    rarity: "uncommon",
  },
  profile_views_100: {
    id: "profile_views_100",
    title: "Noticed",
    description: "Get 100 profile views",
    icon: "👀",
    rarity: "uncommon",
  },
  top_post: {
    id: "top_post",
    title: "Trending",
    description: "Get a post with 50+ likes",
    icon: "🔥",
    rarity: "rare",
  },
  social_links: {
    id: "social_links",
    title: "Connected",
    description: "Add social media links",
    icon: "🔗",
    rarity: "common",
  },
  bio_customization: {
    id: "bio_customization",
    title: "Creative",
    description: "Customize your bio with status",
    icon: "🎨",
    rarity: "common",
  },
}

export function evaluateAchievements(
  profile: Profile,
  posts: Post[],
  followerCount: number,
  profileViews: number,
  socialLinks: any
): AchievementType[] {
  const unlocked: AchievementType[] = []

  const metrics = calculateProfileCompletionMetrics(profile)
  if (metrics.percentage === 100) unlocked.push("profile_complete")
  if (profile.verified) unlocked.push("verified")
  if (followerCount >= 100) unlocked.push("100_followers")
  if (followerCount >= 10) unlocked.push("10_followers")
  if (posts.length >= 1) unlocked.push("first_post")
  if (posts.length >= 10) unlocked.push("10_posts")
  if (profileViews >= 100) unlocked.push("profile_views_100")
  if (posts.some((p) => p.likes >= 50)) unlocked.push("top_post")
  if (Object.keys(socialLinks).length > 0) unlocked.push("social_links")
  if (profile.bio && profile.bio.length > 50) unlocked.push("bio_customization")

  return unlocked
}

// ===== PINNED POSTS MANAGEMENT =====

export interface PinnedPostsConfig {
  pinnedPostIds: string[]
  maxPinned: number
  isPinned(postId: string): boolean
  togglePin(postId: string): void
}

export function createPinnedPostsManager(maxPinned: number = 3): {
  state: string[]
  isPinned(id: string): boolean
  togglePin(id: string): void
  getPinned(posts: Post[]): Post[]
} {
  const state: string[] = []

  return {
    state,
    isPinned(id: string): boolean {
      return state.includes(id)
    },
    togglePin(id: string): void {
      if (state.includes(id)) {
        state.splice(state.indexOf(id), 1)
      } else if (state.length < maxPinned) {
        state.unshift(id)
      }
    },
    getPinned(posts: Post[]): Post[] {
      return posts.filter((p) => state.includes(p.id))
    },
  }
}

// ===== SKILLS & INTERESTS ENHANCED =====

export interface SkillsProfile {
  skills: string[] // e.g., "Photography", "Cooking"
  endorsements: Record<string, number> // skill -> count
  interests: string[] // hobbies/interests
  languages: string[]
}

export function validateSkill(skill: string): boolean {
  return skill && skill.length >= 2 && skill.length <= 30
}

export function validateInterest(interest: string): boolean {
  return interest && interest.length >= 2 && interest.length <= 30
}

export function countEndorsements(profile: any): number {
  return Object.values(profile.endorsements || {}).reduce((sum: number, count: any) => sum + (count || 0), 0)
}

// ===== SOCIAL LINKS MANAGEMENT =====

export type SocialPlatform = "instagram" | "twitter" | "linkedin" | "facebook" | "tiktok" | "youtube" | "website"

export interface SocialLink {
  platform: SocialPlatform
  handle: string
  url: string
  verified: boolean
}

export const SOCIAL_PLATFORMS: Record<SocialPlatform, { icon: string; name: string; baseUrl: string }> = {
  instagram: { icon: "📷", name: "Instagram", baseUrl: "https://instagram.com/" },
  twitter: { icon: "𝕏", name: "Twitter/X", baseUrl: "https://twitter.com/" },
  linkedin: { icon: "💼", name: "LinkedIn", baseUrl: "https://linkedin.com/in/" },
  facebook: { icon: "f", name: "Facebook", baseUrl: "https://facebook.com/" },
  tiktok: { icon: "🎵", name: "TikTok", baseUrl: "https://tiktok.com/@" },
  youtube: { icon: "▶️", name: "YouTube", baseUrl: "https://youtube.com/@" },
  website: { icon: "🌐", name: "Website", baseUrl: "" },
}

export function buildSocialUrl(platform: SocialPlatform, handle: string): string {
  if (platform === "website") return handle.startsWith("http") ? handle : `https://${handle}`
  return SOCIAL_PLATFORMS[platform].baseUrl + handle
}

// ===== VERIFICATION BADGES =====

export type VerificationStatus = "unverified" | "pending" | "verified"

export interface VerificationBadge {
  status: VerificationStatus
  icon: string
  label: string
  color: string
}

export const VERIFICATION_BADGES: Record<VerificationStatus, VerificationBadge> = {
  unverified: {
    status: "unverified",
    icon: "○",
    label: "Unverified",
    color: "gray",
  },
  pending: {
    status: "pending",
    icon: "⏳",
    label: "Pending",
    color: "yellow",
  },
  verified: {
    status: "verified",
    icon: "✓",
    label: "Verified",
    color: "blue",
  },
}

// ===== ACTIVITY HISTORY =====

export type ActivityType = "post" | "like" | "comment" | "follow" | "profile_update" | "achievement_unlocked"

export interface Activity {
  type: ActivityType
  description: string
  timestamp: number
  metadata?: Record<string, any>
}

export function formatActivityTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

// ===== PRIVACY CONTROLS =====

export type ProfileVisibility = "everyone" | "followers" | "matches" | "hidden"
export type MessagePermission = "everyone" | "followers" | "matches" | "no-one"

export interface PrivacySettings {
  profileVisibility: ProfileVisibility
  canMessage: MessagePermission
  showLastSeen: boolean
  showOnlineStatus: boolean
  allowSearchIndexing: boolean
  blockedUsers: string[]
}

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  profileVisibility: "everyone",
  canMessage: "everyone",
  showLastSeen: true,
  showOnlineStatus: true,
  allowSearchIndexing: true,
  blockedUsers: [],
}

// ===== PROFILE ANALYTICS =====

export interface ProfileAnalytics {
  viewCount: number
  profileViews: Array<{ date: string; count: number }>
  topReferrers: Array<{ source: string; count: number }>
  visitorsThisMonth: number
  avgTimeSpent: number // seconds
  bounceRate: number // 0-100%
}

export function calculateProfileAnalytics(profile: any): ProfileAnalytics {
  return {
    viewCount: profile.viewCount || 0,
    profileViews: profile.profileViews || [],
    topReferrers: profile.topReferrers || [],
    visitorsThisMonth: profile.visitorsThisMonth || 0,
    avgTimeSpent: profile.avgTimeSpent || 0,
    bounceRate: profile.bounceRate || 0,
  }
}

// ===== FOLLOWER INSIGHTS =====

export interface FollowerInsight {
  totalFollowers: number
  newFollowersThisMonth: number
  topFollowerCountries: Array<{ country: string; count: number }>
  ageDistribution: Record<string, number>
  genderDistribution: Record<string, number>
}

export function calculateFollowerInsights(profile: any): FollowerInsight {
  return {
    totalFollowers: profile.totalFollowers || 0,
    newFollowersThisMonth: profile.newFollowersThisMonth || 0,
    topFollowerCountries: profile.topFollowerCountries || [],
    ageDistribution: profile.ageDistribution || {},
    genderDistribution: profile.genderDistribution || {},
  }
}

// ===== SAVED CONTENT MANAGEMENT =====

export type SaveCollection = "later" | "favorites" | "research" | "ideas" | "custom"

export interface SavedContent {
  postId: string
  collection: SaveCollection
  savedAt: number
  notes?: string
}

export function addToCollection(postId: string, collection: SaveCollection, notes?: string): SavedContent {
  return {
    postId,
    collection,
    savedAt: Date.now(),
    notes,
  }
}

// ===== QR PROFILE SHARING =====

export interface QRProfileConfig {
  enabled: boolean
  url: string
  includeContactInfo: boolean
  includePhoto: boolean
  customMessage?: string
}

export function generateProfileQRConfig(profile: Profile, baseUrl: string): QRProfileConfig {
  return {
    enabled: true,
    url: `${baseUrl}/profile/${profile.displayName.toLowerCase().replace(/\s+/g, "-")}`,
    includeContactInfo: true,
    includePhoto: true,
    customMessage: `Check out ${profile.displayName}'s profile!`,
  }
}

// ===== ACCOUNT MANAGEMENT =====

export interface AccountManagementOptions {
  canDeactivate: boolean
  canDelete: boolean
  canExportData: boolean
  canDownloadArchive: boolean
  lastBackupDate?: number
  dataSize?: number // bytes
}

export function getAccountManagementOptions(): AccountManagementOptions {
  return {
    canDeactivate: true,
    canDelete: true,
    canExportData: true,
    canDownloadArchive: true,
  }
}

// ===== STATE MANAGEMENT HELPERS =====

export interface EnhancedProfileState {
  profile: Profile
  completion: ProfileCompletionMetrics
  achievements: AchievementType[]
  pinnedPostIds: string[]
  savedContent: SavedContent[]
  privacySettings: PrivacySettings
  analytics: ProfileAnalytics
  followerInsights: FollowerInsight
  socialLinks: Record<SocialPlatform, SocialLink | null>
  skills: SkillsProfile
  isLoading: boolean
  error: string | null
}

export function createEnhancedProfileState(profile: Profile, posts: Post[]): EnhancedProfileState {
  return {
    profile,
    completion: calculateProfileCompletionMetrics(profile),
    achievements: evaluateAchievements(profile, posts, 0, 0, {}),
    pinnedPostIds: [],
    savedContent: [],
    privacySettings: DEFAULT_PRIVACY_SETTINGS,
    analytics: calculateProfileAnalytics(profile),
    followerInsights: calculateFollowerInsights(profile),
    socialLinks: {} as Record<SocialPlatform, SocialLink | null>,
    skills: { skills: [], endorsements: {}, interests: profile.interests, languages: [] },
    isLoading: false,
    error: null,
  }
}
