/**
 * AchievementDomain — verified activity milestones.
 *
 * Separate from Reward Engine (GHC) and Reputation (trust score).
 * Unlocking may *emit* ACHIEVEMENT_UNLOCKED so rewards/reputation can react;
 * this domain does not grant GHC itself.
 */

import { runMutation, type MutationResult } from "./mutation-pipeline"
import { domainEvents } from "../realtime/event-bus"
import type { Profile, Post } from "../ghc-types"

export type AchievementId =
  | "profile_builder"
  | "community_builder"
  | "helpful_contributor"
  | "trusted_seller"
  | "creator"
  | "early_member"
  | "mentor"
  | "top_contributor"
  | "marketplace_milestone"
  // legacy aliases from profile-enhancements (compat)
  | "profile_complete"
  | "first_post"
  | "10_posts"
  | "verified"

export type AchievementRarity = "common" | "uncommon" | "rare" | "epic"

export interface AchievementDefinition {
  id: AchievementId
  title: string
  description: string
  icon: string
  rarity: AchievementRarity
  /** Logical check key */
  criterion: string
}

export interface UnlockedAchievement {
  id: AchievementId
  unlockedAt: number
  sourceEvent?: string
}

export const ACHIEVEMENT_CATALOG: AchievementDefinition[] = [
  {
    id: "profile_builder",
    title: "Profile Builder",
    description: "Complete your profile identity",
    icon: "🧱",
    rarity: "common",
    criterion: "profile_complete",
  },
  {
    id: "community_builder",
    title: "Community Builder",
    description: "Create or actively lead a community",
    icon: "🏘️",
    rarity: "rare",
    criterion: "community_leadership",
  },
  {
    id: "helpful_contributor",
    title: "Helpful Contributor",
    description: "Make meaningful comments across the platform",
    icon: "💬",
    rarity: "uncommon",
    criterion: "comments_10",
  },
  {
    id: "trusted_seller",
    title: "Trusted Seller",
    description: "Complete marketplace sales with positive outcomes",
    icon: "🛡️",
    rarity: "rare",
    criterion: "marketplace_sales_3",
  },
  {
    id: "creator",
    title: "Creator",
    description: "Publish quality posts consistently",
    icon: "✍️",
    rarity: "uncommon",
    criterion: "posts_10",
  },
  {
    id: "early_member",
    title: "Early Member",
    description: "Joined during the early GreenHaven period",
    icon: "🌱",
    rarity: "epic",
    criterion: "early_member",
  },
  {
    id: "mentor",
    title: "Mentor",
    description: "Support others through mentorship matching",
    icon: "🎓",
    rarity: "rare",
    criterion: "mentor_match",
  },
  {
    id: "top_contributor",
    title: "Top Contributor",
    description: "Sustained high-quality platform contribution",
    icon: "🏆",
    rarity: "epic",
    criterion: "top_contributor",
  },
  {
    id: "marketplace_milestone",
    title: "Marketplace Milestone",
    description: "Reach a marketplace activity milestone",
    icon: "🛍️",
    rarity: "uncommon",
    criterion: "marketplace_activity",
  },
  {
    id: "profile_complete",
    title: "Profile Complete",
    description: "Fill required profile fields",
    icon: "✅",
    rarity: "common",
    criterion: "profile_complete",
  },
  {
    id: "first_post",
    title: "First Post",
    description: "Publish your first post",
    icon: "📝",
    rarity: "common",
    criterion: "posts_1",
  },
  {
    id: "10_posts",
    title: "Active Creator",
    description: "Publish 10 posts",
    icon: "📚",
    rarity: "uncommon",
    criterion: "posts_10",
  },
  {
    id: "verified",
    title: "Verified Member",
    description: "Account verification completed",
    icon: "✓",
    rarity: "uncommon",
    criterion: "verified",
  },
]

const STORAGE_KEY = "ghc_achievements_v1"

function loadUnlocked(userId: string): UnlockedAchievement[] {
  try {
    if (typeof localStorage === "undefined") return []
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const all = JSON.parse(raw) as Record<string, UnlockedAchievement[]>
    return all[userId] || []
  } catch {
    return []
  }
}

function saveUnlocked(userId: string, list: UnlockedAchievement[]) {
  try {
    if (typeof localStorage === "undefined") return
    const raw = localStorage.getItem(STORAGE_KEY)
    const all = raw ? JSON.parse(raw) : {}
    all[userId] = list
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* */
  }
}

export interface AchievementContext {
  profile?: Profile
  posts?: Post[]
  followerCount?: number
  commentCount?: number
  communityLeadership?: boolean
  marketplaceSales?: number
  marketplaceActivity?: number
  isMentor?: boolean
  isEarlyMember?: boolean
  contributionScore?: number
}

function criteriaMet(criterion: string, ctx: AchievementContext): boolean {
  const posts = ctx.posts || []
  switch (criterion) {
    case "profile_complete": {
      const p = ctx.profile
      if (!p) return false
      return Boolean(
        p.displayName &&
          p.bio &&
          p.profession &&
          (p.interests?.length || 0) >= 3 &&
          (p.photos?.length || 0) >= 1
      )
    }
    case "verified":
      return Boolean(ctx.profile?.verified)
    case "posts_1":
      return posts.length >= 1
    case "posts_10":
      return posts.length >= 10
    case "comments_10":
      return (ctx.commentCount || 0) >= 10
    case "community_leadership":
      return Boolean(ctx.communityLeadership)
    case "marketplace_sales_3":
      return (ctx.marketplaceSales || 0) >= 3
    case "marketplace_activity":
      return (ctx.marketplaceActivity || 0) >= 5
    case "mentor_match":
      return Boolean(ctx.isMentor)
    case "early_member":
      return Boolean(ctx.isEarlyMember)
    case "top_contributor":
      return (ctx.contributionScore || 0) >= 100
    default:
      return false
  }
}

let achieveBridgeUnsub: (() => void) | null = null

export function createAchievementDomain(deps: {
  currentUserId?: string
  getContext?: () => AchievementContext
}) {
  const userId = deps.currentUserId || "current-user"

  return {
    getCatalog(): AchievementDefinition[] {
      return ACHIEVEMENT_CATALOG
    },

    getUnlocked(forUserId = userId): UnlockedAchievement[] {
      return loadUnlocked(forUserId)
    },

    /** For Profile presentation */
    getUnlockedForProfile(forUserId = userId): Array<AchievementDefinition & { unlockedAt: number }> {
      const unlocked = loadUnlocked(forUserId)
      const byId = new Map(unlocked.map((u) => [u.id, u]))
      return ACHIEVEMENT_CATALOG.filter((d) => byId.has(d.id)).map((d) => ({
        ...d,
        unlockedAt: byId.get(d.id)!.unlockedAt,
      }))
    },

    has(id: AchievementId, forUserId = userId): boolean {
      return loadUnlocked(forUserId).some((u) => u.id === id)
    },

    /**
     * Evaluate catalog against activity context — unlock newly met milestones.
     * Does not grant GHC (Reward Engine may listen to ACHIEVEMENT_UNLOCKED).
     */
    async evaluate(
      ctx?: AchievementContext,
      sourceEvent = "ACHIEVEMENT_EVAL"
    ): Promise<MutationResult<{ newlyUnlocked: UnlockedAchievement[] }>> {
      return runMutation({
        name: "achievement.evaluate",
        actorId: userId,
        input: { sourceEvent },
        mutate: () => {
          const context = ctx || deps.getContext?.() || {}
          const existing = loadUnlocked(userId)
          const have = new Set(existing.map((e) => e.id))
          const newly: UnlockedAchievement[] = []

          for (const def of ACHIEVEMENT_CATALOG) {
            if (have.has(def.id)) continue
            if (!criteriaMet(def.criterion, context)) continue
            const row: UnlockedAchievement = {
              id: def.id,
              unlockedAt: Date.now(),
              sourceEvent,
            }
            existing.push(row)
            newly.push(row)
            domainEvents.publish(
              "ACHIEVEMENT_UNLOCKED",
              { achievementId: def.id, title: def.title },
              userId,
              def.id
            )
          }

          if (newly.length) saveUnlocked(userId, existing)
          return { newlyUnlocked: newly }
        },
      })
    },

    /** Explicit unlock for verified backend-confirmed milestones */
    async unlock(
      id: AchievementId,
      sourceEvent = "ACHIEVEMENT_MANUAL"
    ): Promise<MutationResult<{ achievement: UnlockedAchievement }>> {
      return runMutation({
        name: "achievement.unlock",
        actorId: userId,
        input: { id },
        validate: (i) => {
          if (!ACHIEVEMENT_CATALOG.some((d) => d.id === i.id)) return "Unknown achievement"
          if (this.has(i.id)) return "Already unlocked"
          return null
        },
        mutate: (i) => {
          const row: UnlockedAchievement = {
            id: i.id,
            unlockedAt: Date.now(),
            sourceEvent,
          }
          const list = loadUnlocked(userId)
          list.push(row)
          saveUnlocked(userId, list)
          const def = ACHIEVEMENT_CATALOG.find((d) => d.id === i.id)!
          domainEvents.publish(
            "ACHIEVEMENT_UNLOCKED",
            { achievementId: i.id, title: def.title },
            userId,
            i.id
          )
          return { achievement: row }
        },
      })
    },

    startEventBridge(): () => void {
      if (achieveBridgeUnsub) return achieveBridgeUnsub
      const triggers = new Set([
        "ONBOARDING_COMPLETED",
        "PROFILE_UPDATED",
        "POST_CREATED",
        "COMMENT_CREATED",
        "GROUP_JOINED",
        "COMMUNITY_ROLE_CHANGED",
        "MARKETPLACE_ORDER_COMPLETED",
        "MATCH_CREATED",
      ])
      achieveBridgeUnsub = domainEvents.on("*", (event) => {
        try {
          if (!triggers.has(event.type)) return
          void this.evaluate(deps.getContext?.(), event.type)
        } catch {
          /* */
        }
      })
      return () => {
        achieveBridgeUnsub?.()
        achieveBridgeUnsub = null
      }
    },

    stopEventBridge() {
      achieveBridgeUnsub?.()
      achieveBridgeUnsub = null
    },
  }
}

export type AchievementDomain = ReturnType<typeof createAchievementDomain>
