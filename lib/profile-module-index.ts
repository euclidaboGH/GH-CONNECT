/**
 * Profile Module - Complete Integration Index
 * 
 * This file exports all profile-related enhancements, utilities, and types
 * for easy access across the application.
 * 
 * Organized by feature:
 * - Profile Completion & Metrics
 * - Achievements System
 * - Pinned Posts Management
 * - Skills & Endorsements
 * - Social Links Management
 * - Verification Badges
 * - Activity History
 * - Privacy Controls
 * - Profile Analytics
 * - Follower Insights
 * - Saved Content
 * - QR Profile Sharing
 * - Account Management
 * - State Management Helpers
 */

// ===== PROFILE COMPLETION & METRICS =====
export {
  calculateProfileCompletionMetrics,
  type ProfileCompletionMetrics,
} from "@/lib/profile-enhancements"

// ===== ACHIEVEMENTS SYSTEM =====
export {
  ACHIEVEMENTS,
  evaluateAchievements,
  type AchievementType,
  type Achievement,
} from "@/lib/profile-enhancements"

// ===== PINNED POSTS MANAGEMENT =====
export {
  createPinnedPostsManager,
  type PinnedPostsConfig,
} from "@/lib/profile-enhancements"

// ===== SKILLS & ENDORSEMENTS =====
export {
  validateSkill,
  validateInterest,
  countEndorsements,
  type SkillsProfile,
} from "@/lib/profile-enhancements"

// ===== SOCIAL LINKS MANAGEMENT =====
export {
  SOCIAL_PLATFORMS,
  buildSocialUrl,
  type SocialLink,
  type SocialPlatform,
} from "@/lib/profile-enhancements"

// ===== VERIFICATION BADGES =====
export {
  VERIFICATION_BADGES,
  type VerificationStatus,
  type VerificationBadge,
} from "@/lib/profile-enhancements"

// ===== ACTIVITY HISTORY =====
export {
  formatActivityTime,
  type Activity,
  type ActivityType,
} from "@/lib/profile-enhancements"

// ===== PRIVACY CONTROLS =====
export {
  DEFAULT_PRIVACY_SETTINGS,
  type PrivacySettings,
  type ProfileVisibility,
  type MessagePermission,
} from "@/lib/profile-enhancements"

// ===== PROFILE ANALYTICS =====
export {
  calculateProfileAnalytics,
  type ProfileAnalytics,
} from "@/lib/profile-enhancements"

// ===== FOLLOWER INSIGHTS =====
export {
  calculateFollowerInsights,
  type FollowerInsight,
} from "@/lib/profile-enhancements"

// ===== SAVED CONTENT MANAGEMENT =====
export {
  addToCollection,
  type SaveCollection,
  type SavedContent,
} from "@/lib/profile-enhancements"

// ===== QR PROFILE SHARING =====
export {
  generateProfileQRConfig,
  type QRProfileConfig,
} from "@/lib/profile-enhancements"

// ===== ACCOUNT MANAGEMENT =====
export {
  getAccountManagementOptions,
  type AccountManagementOptions,
} from "@/lib/profile-enhancements"

// ===== STATE MANAGEMENT HELPERS =====
export {
  createEnhancedProfileState,
  type EnhancedProfileState,
} from "@/lib/profile-enhancements"

// ===== UI COMPONENTS =====
export {
  ProfileAnalyticsCard,
  FollowerInsightsCard,
  EnhancedAchievementsGrid,
  SkillsSection,
  EnhancedSocialLinksSection,
  PinnedPostsSection,
  EnhancedQRProfileShare,
  ProfileVisibilityStatus,
} from "@/components/ghc/profile-enhancements-ui"
