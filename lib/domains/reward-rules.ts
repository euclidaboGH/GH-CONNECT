/**
 * Configurable reward rules by category.
 * Tune amounts/limits here without rewriting the reward engine.
 */

import type { RewardRule, RewardCategory } from "./economy-types"

export const REWARD_CATEGORIES: RewardCategory[] = [
  "social",
  "community",
  "achievement",
  "marketplace",
  "challenge",
  "referral",
  "creator",
  "professional",
]

/** Default catalog — not blind engagement farming */
export const DEFAULT_REWARD_RULES: RewardRule[] = [
  {
    id: "daily_checkin",
    category: "achievement",
    sourceEvent: "DAILY_CHECKIN",
    description: "Daily GreenHaven check-in reward",
    amount: 10,
    dailyLimit: 1,
    requiresValidation: false,
    antiAbuse: { blockSelf: true, cooldownMs: 0 },
    enabled: true,
  },
  {
    id: "profile_completion",
    category: "achievement",
    sourceEvent: "ONBOARDING_COMPLETED",
    description: "Complete your profile",
    amount: 25,
    dailyLimit: 1,
    requiresValidation: false,
    antiAbuse: { blockSelf: true, cooldownMs: 0 },
    enabled: true,
  },
  {
    id: "quality_comment",
    category: "social",
    sourceEvent: "COMMENT_CREATED",
    description: "Helpful comment on others' posts",
    amount: 2,
    dailyLimit: 10,
    requiresValidation: false,
    antiAbuse: { blockSelf: true, cooldownMs: 60_000, maxPerTargetPerDay: 2 },
    enabled: true,
  },
  {
    id: "community_join_active",
    category: "community",
    sourceEvent: "GROUP_JOINED",
    description: "Join and participate in a community",
    amount: 5,
    dailyLimit: 3,
    requiresValidation: false,
    antiAbuse: { blockSelf: true, cooldownMs: 3_600_000 },
    enabled: true,
  },
  {
    id: "community_leadership",
    category: "community",
    sourceEvent: "COMMUNITY_ROLE_CHANGED",
    description: "Community leadership contribution",
    amount: 15,
    dailyLimit: 2,
    requiresValidation: true,
    antiAbuse: { blockSelf: true, cooldownMs: 86_400_000 },
    enabled: true,
  },
  {
    id: "creator_post",
    category: "creator",
    sourceEvent: "POST_CREATED",
    description: "Quality creator contribution",
    amount: 3,
    dailyLimit: 5,
    requiresValidation: false,
    antiAbuse: { blockSelf: true, cooldownMs: 300_000 },
    enabled: true,
  },
  {
    id: "referral_verified",
    category: "referral",
    sourceEvent: "REFERRAL_VERIFIED",
    description: "Genuine verified referral",
    amount: 50,
    dailyLimit: 5,
    requiresValidation: true,
    antiAbuse: { blockSelf: true, cooldownMs: 0 },
    enabled: true,
  },
  {
    id: "marketplace_sale",
    category: "marketplace",
    sourceEvent: "MARKETPLACE_ORDER_COMPLETED",
    description: "Completed marketplace activity",
    amount: 10,
    dailyLimit: 20,
    requiresValidation: true,
    antiAbuse: { blockSelf: true, cooldownMs: 0 },
    enabled: true,
  },
  {
    id: "challenge_approved",
    category: "challenge",
    sourceEvent: "CHALLENGE_COMPLETED",
    description: "Approved challenge completion",
    amount: 30,
    dailyLimit: 3,
    requiresValidation: true,
    antiAbuse: { blockSelf: true, cooldownMs: 0 },
    enabled: true,
  },
  {
    id: "professional_milestone",
    category: "professional",
    sourceEvent: "PROFESSIONAL_MILESTONE",
    description: "Professional networking milestone",
    amount: 20,
    dailyLimit: 2,
    requiresValidation: true,
    antiAbuse: { blockSelf: true, cooldownMs: 86_400_000 },
    enabled: true,
  },
  {
    id: "verified_achievement",
    category: "achievement",
    sourceEvent: "ACHIEVEMENT_UNLOCKED",
    description: "Verified platform achievement",
    amount: 40,
    dailyLimit: 5,
    requiresValidation: true,
    antiAbuse: { blockSelf: true, cooldownMs: 0 },
    enabled: true,
  },
]

export function rulesBySourceEvent(
  rules: RewardRule[],
  sourceEvent: string
): RewardRule[] {
  return rules.filter((r) => r.enabled && r.sourceEvent === sourceEvent)
}

export function rulesByCategory(
  rules: RewardRule[],
  category: RewardCategory
): RewardRule[] {
  return rules.filter((r) => r.enabled && r.category === category)
}
