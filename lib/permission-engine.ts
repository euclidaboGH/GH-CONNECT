/**
 * Universal Permission Engine — single authoritative source for action rights.
 *
 * Golden rule: UI never invents business permission rules.
 * Pattern: User action → domain → validate → permission check → mutate → event → UI
 *
 * Client checks are a UX/cache layer. Server must re-validate everything later.
 *
 * Block always preempts normal social interaction.
 */

export type ActorId = string
export type TargetId = string

/** Canonical actions UI and domains may ask about */
export type PermissionAction =
  | "view_profile"
  | "follow"
  | "connect"
  | "match"
  | "message"
  | "comment"
  | "reply"
  | "react"
  | "share"
  | "save"
  | "join_community"
  | "invite"
  | "view_story"
  | "report"
  | "block"
  | "marketplace_browse"
  | "marketplace_buy"
  | "marketplace_sell"
  | "wallet_view"
  | "wallet_send"
  | "reward_claim"
  | "premium_feature"

export type MembershipTier = "free" | "premium" | "vip" | "vvip" | "verified"

export interface PermissionContext {
  currentUserId: ActorId
  /** Users the current user has blocked */
  blockedByMe: string[]
  /** Users who have blocked the current user (when known) */
  blockedMe?: string[]
  followingIds?: string[]
  matchIds?: string[]
  friendIds?: string[]
  mutedIds?: string[]
  restrictedIds?: string[]
  /** Privacy settings of the current user */
  whoCanMessage?: "everyone" | "matches-only" | "no-one"
  profileVisibility?: "everyone" | "matches-only" | "hidden"
  storyVisibility?: "everyone" | "matches-only" | "no-one"
  /** Optional: target user's privacy when available */
  targetWhoCanMessage?: "everyone" | "matches-only" | "no-one"
  targetProfileVisibility?: "everyone" | "matches-only" | "hidden"
  targetStoryVisibility?: "everyone" | "matches-only" | "no-one"
  /** Economy / membership (default free until domains exist) */
  membership?: MembershipTier
  /** Entitlement keys from membership domain (preferred over membership tier alone) */
  entitlements?: string[]
  /** Identity/creator verification — independent of VIP/VVIP */
  identityVerified?: boolean
  /** Wallet available / KYC for payments */
  walletEnabled?: boolean
  /** Can participate in marketplace */
  marketplaceEnabled?: boolean
  /** Community join policy for a specific group (when known) */
  communityJoinPolicy?: "open" | "approval" | "invite-only" | "closed"
  /** Actor is already a member of target community */
  isCommunityMember?: boolean
  /** Actor can invite others to community (owner/admin) */
  canInviteToCommunity?: boolean
}

export interface PermissionDecision {
  allowed: boolean
  reason?: string
  action: PermissionAction
}

function isSelf(ctx: PermissionContext, targetId: TargetId) {
  return targetId === ctx.currentUserId
}

function isBlockedEitherWay(ctx: PermissionContext, targetId: TargetId) {
  if (ctx.blockedByMe.includes(targetId)) return true
  if (ctx.blockedMe?.includes(targetId)) return true
  return false
}

function isConnected(ctx: PermissionContext, targetId: TargetId) {
  return (
    (ctx.matchIds?.includes(targetId) ?? false) ||
    (ctx.friendIds?.includes(targetId) ?? false)
  )
}

function isPremium(ctx: PermissionContext) {
  const m = ctx.membership
  return m === "premium" || m === "vip" || m === "vvip"
  // Note: "verified" is NOT premium — verification is independent
}

function deny(action: PermissionAction, reason: string): PermissionDecision {
  return { allowed: false, reason, action }
}

function allow(action: PermissionAction): PermissionDecision {
  return { allowed: true, action }
}

/** Block is a system-wide gate — every module should call this before interaction */
export function isBlocked(ctx: PermissionContext, targetId: TargetId): boolean {
  if (isSelf(ctx, targetId)) return false
  return isBlockedEitherWay(ctx, targetId)
}

// ── Core social ───────────────────────────────────────────────────────────

export function canViewProfile(ctx: PermissionContext, targetId: TargetId): boolean {
  if (isSelf(ctx, targetId)) return true
  if (isBlockedEitherWay(ctx, targetId)) return false
  const visibility = ctx.targetProfileVisibility ?? "everyone"
  if (visibility === "hidden") return false
  if (visibility === "matches-only") return isConnected(ctx, targetId)
  return true
}

export function canViewStory(ctx: PermissionContext, ownerId: TargetId): boolean {
  if (isSelf(ctx, ownerId)) return true
  if (isBlockedEitherWay(ctx, ownerId)) return false
  const visibility = ctx.targetStoryVisibility ?? "everyone"
  if (visibility === "no-one") return false
  if (visibility === "matches-only") return isConnected(ctx, ownerId)
  return true
}

export function canMessageUser(ctx: PermissionContext, targetId: TargetId): boolean {
  if (isSelf(ctx, targetId)) return false
  if (isBlockedEitherWay(ctx, targetId)) return false
  // Mute does not block messaging; restrict limits inbound via canReceiveInteractionFrom
  if (ctx.whoCanMessage === "no-one") return false
  if (ctx.targetWhoCanMessage === "no-one") return false
  if (ctx.whoCanMessage === "matches-only" && !isConnected(ctx, targetId)) return false
  if (ctx.targetWhoCanMessage === "matches-only" && !isConnected(ctx, targetId)) return false
  return true
}

/**
 * Whether another user may interact with the current user (comment on my posts,
 * react, story reply). Restricted and blocked cannot. Mute does not apply here.
 */
export function canReceiveInteractionFrom(ctx: PermissionContext, otherId: TargetId): boolean {
  if (isSelf(ctx, otherId)) return true
  if (isBlockedEitherWay(ctx, otherId)) return false
  if ((ctx.restrictedIds || []).includes(otherId)) return false
  return true
}

export function canFollow(ctx: PermissionContext, targetId: TargetId): boolean {
  if (isSelf(ctx, targetId)) return false
  if (isBlockedEitherWay(ctx, targetId)) return false
  return true
}

/** Connection / friend request */
export function canConnect(ctx: PermissionContext, targetId: TargetId): boolean {
  if (isSelf(ctx, targetId)) return false
  if (isBlockedEitherWay(ctx, targetId)) return false
  if (ctx.friendIds?.includes(targetId)) return false
  return true
}

export function canMatch(ctx: PermissionContext, targetId: TargetId): boolean {
  if (isSelf(ctx, targetId)) return false
  if (isBlockedEitherWay(ctx, targetId)) return false
  return true
}

/** Social interaction (request, match, non-message gates) — blocked always wins */
export function canInteractSocially(ctx: PermissionContext, targetId: TargetId): boolean {
  if (isSelf(ctx, targetId)) return false
  if (isBlockedEitherWay(ctx, targetId)) return false
  return true
}

export function canLike(ctx: PermissionContext, authorId: TargetId): boolean {
  // Outbound react on someone's content — blocked only
  if (isBlockedEitherWay(ctx, authorId)) return false
  return true
}

/** Alias: react on post/comment/message */
export function canReact(ctx: PermissionContext, authorId: TargetId): boolean {
  return canLike(ctx, authorId)
}

export function canComment(ctx: PermissionContext, authorId: TargetId): boolean {
  if (isBlockedEitherWay(ctx, authorId)) return false
  return true
}

export function canReply(ctx: PermissionContext, authorId: TargetId): boolean {
  return canComment(ctx, authorId)
}

export function canShare(ctx: PermissionContext, authorId?: TargetId): boolean {
  if (authorId && isBlockedEitherWay(ctx, authorId)) return false
  return true
}

export function canSave(_ctx: PermissionContext, _contentId?: string): boolean {
  // Authenticated session assumed when PermissionContext exists
  return true
}

export function canDeletePost(ctx: PermissionContext, authorId: TargetId): boolean {
  return isSelf(ctx, authorId)
}

export function canEditPost(ctx: PermissionContext, authorId: TargetId): boolean {
  return isSelf(ctx, authorId)
}

export function canDeleteMessage(
  ctx: PermissionContext,
  senderId: TargetId,
  deleteForEveryone: boolean
): boolean {
  if (deleteForEveryone) return isSelf(ctx, senderId)
  return true
}

export function canDeleteMessageForEveryone(
  ctx: PermissionContext,
  senderId: TargetId,
  createdAt: number,
  windowMs = 60 * 60 * 1000
): boolean {
  if (!isSelf(ctx, senderId)) return false
  return Date.now() - createdAt <= windowMs
}

export function canReport(ctx: PermissionContext, targetId: TargetId): boolean {
  if (isSelf(ctx, targetId)) return false
  return true
}

export function canBlock(ctx: PermissionContext, targetId: TargetId): boolean {
  if (isSelf(ctx, targetId)) return false
  return true
}

// ── Community ─────────────────────────────────────────────────────────────

export function canJoinCommunity(ctx: PermissionContext): boolean {
  const policy = ctx.communityJoinPolicy || "open"
  if (policy === "closed") return false
  if (ctx.isCommunityMember) return false
  if (policy === "invite-only") return false // must use invite path
  // open | approval → allowed to request/join
  return true
}

export function canInviteToCommunity(ctx: PermissionContext): boolean {
  if (ctx.canInviteToCommunity === true) return true
  // Default: members of open groups cannot invite unless flagged
  return false
}

// ── Economy / wallet / rewards / premium (scaffold — safe defaults) ───────

export function canBrowseMarketplace(ctx: PermissionContext): boolean {
  return ctx.marketplaceEnabled !== false
}

export function canBuyOnMarketplace(ctx: PermissionContext): boolean {
  if (ctx.marketplaceEnabled === false) return false
  if (ctx.walletEnabled === false) return false
  return true
}

export function canSellOnMarketplace(ctx: PermissionContext): boolean {
  if (ctx.marketplaceEnabled === false) return false
  // Selling may require verified later; free tier allowed as default product policy
  return true
}

export function canViewWallet(ctx: PermissionContext): boolean {
  return ctx.walletEnabled !== false
}

export function canSendFromWallet(ctx: PermissionContext): boolean {
  if (ctx.walletEnabled === false) return false
  return true
}

export function canClaimReward(ctx: PermissionContext): boolean {
  // Eligibility rules expand with rewards domain; base: authenticated
  return true
}

export function canUsePremiumFeature(ctx: PermissionContext, featureKey?: string): boolean {
  // Prefer entitlement list from membership domain when present
  if (featureKey && ctx.entitlements && ctx.entitlements.length > 0) {
    return ctx.entitlements.includes(featureKey)
  }
  if (featureKey && ctx.entitlements && ctx.entitlements.length === 0 && ctx.membership === "free") {
    return false
  }
  return isPremium(ctx)
}

/** Verification is never granted by VIP/VVIP purchase */
export function isIdentityVerified(ctx: PermissionContext): boolean {
  return ctx.identityVerified === true
}

// ── Unified decision API ──────────────────────────────────────────────────

/**
 * Single entry for UI and domains. Prefer this over ad-hoc boolean checks
 * when you need a reason string for toasts / disabled buttons.
 */
export function checkPermission(
  ctx: PermissionContext,
  action: PermissionAction,
  targetId?: TargetId
): PermissionDecision {
  const id = targetId || ""

  switch (action) {
    case "view_profile":
      if (!id) return deny(action, "Missing user")
      return canViewProfile(ctx, id)
        ? allow(action)
        : deny(action, isBlocked(ctx, id) ? "Blocked" : "Profile not available")

    case "follow":
      if (!id) return deny(action, "Missing user")
      return canFollow(ctx, id) ? allow(action) : deny(action, "Cannot follow this user")

    case "connect":
      if (!id) return deny(action, "Missing user")
      return canConnect(ctx, id) ? allow(action) : deny(action, "Cannot send connection request")

    case "match":
      if (!id) return deny(action, "Missing user")
      return canMatch(ctx, id) ? allow(action) : deny(action, "Cannot match this user")

    case "message":
      if (!id) return deny(action, "Missing user")
      return canMessageUser(ctx, id) ? allow(action) : deny(action, "Messaging not allowed")

    case "comment":
      return canComment(ctx, id || ctx.currentUserId)
        ? allow(action)
        : deny(action, "Cannot comment")

    case "reply":
      return canReply(ctx, id || ctx.currentUserId) ? allow(action) : deny(action, "Cannot reply")

    case "react":
      return canReact(ctx, id || ctx.currentUserId) ? allow(action) : deny(action, "Cannot react")

    case "share":
      return canShare(ctx, id || undefined) ? allow(action) : deny(action, "Cannot share")

    case "save":
      return canSave(ctx) ? allow(action) : deny(action, "Cannot save")

    case "join_community":
      return canJoinCommunity(ctx) ? allow(action) : deny(action, "Cannot join this community")

    case "invite":
      return canInviteToCommunity(ctx) ? allow(action) : deny(action, "Cannot invite")

    case "view_story":
      if (!id) return deny(action, "Missing user")
      return canViewStory(ctx, id) ? allow(action) : deny(action, "Story not available")

    case "report":
      if (!id) return deny(action, "Missing target")
      return canReport(ctx, id) ? allow(action) : deny(action, "Cannot report")

    case "block":
      if (!id) return deny(action, "Missing user")
      return canBlock(ctx, id) ? allow(action) : deny(action, "Cannot block")

    case "marketplace_browse":
      return canBrowseMarketplace(ctx) ? allow(action) : deny(action, "Marketplace unavailable")

    case "marketplace_buy":
      return canBuyOnMarketplace(ctx) ? allow(action) : deny(action, "Cannot purchase")

    case "marketplace_sell":
      return canSellOnMarketplace(ctx) ? allow(action) : deny(action, "Cannot list items")

    case "wallet_view":
      return canViewWallet(ctx) ? allow(action) : deny(action, "Wallet unavailable")

    case "wallet_send":
      return canSendFromWallet(ctx) ? allow(action) : deny(action, "Cannot send")

    case "reward_claim":
      return canClaimReward(ctx) ? allow(action) : deny(action, "Not eligible")

    case "premium_feature":
      return canUsePremiumFeature(ctx) ? allow(action) : deny(action, "Premium required")

    default:
      return deny(action, "Unknown action")
  }
}

/** Boolean convenience wrapper */
export function can(
  ctx: PermissionContext,
  action: PermissionAction,
  targetId?: TargetId
): boolean {
  return checkPermission(ctx, action, targetId).allowed
}

export function buildPermissionContext(input: {
  currentUserId?: string
  blockedUsers?: string[]
  blockedMe?: string[]
  followingIds?: string[]
  matchIds?: string[]
  friendIds?: string[]
  mutedIds?: string[]
  restrictedIds?: string[]
  whoCanMessage?: PermissionContext["whoCanMessage"]
  profileVisibility?: PermissionContext["profileVisibility"]
  storyVisibility?: PermissionContext["storyVisibility"]
  targetWhoCanMessage?: PermissionContext["targetWhoCanMessage"]
  targetProfileVisibility?: PermissionContext["targetProfileVisibility"]
  targetStoryVisibility?: PermissionContext["targetStoryVisibility"]
  membership?: MembershipTier
  walletEnabled?: boolean
  marketplaceEnabled?: boolean
  communityJoinPolicy?: PermissionContext["communityJoinPolicy"]
  isCommunityMember?: boolean
  canInviteToCommunity?: boolean
}): PermissionContext {
  return {
    currentUserId: input.currentUserId || "current-user",
    blockedByMe: input.blockedUsers || [],
    blockedMe: input.blockedMe || [],
    followingIds: input.followingIds || [],
    matchIds: input.matchIds || [],
    friendIds: input.friendIds || [],
    mutedIds: input.mutedIds || [],
    restrictedIds: input.restrictedIds || [],
    whoCanMessage: input.whoCanMessage || "everyone",
    profileVisibility: input.profileVisibility || "everyone",
    storyVisibility: input.storyVisibility || "everyone",
    targetWhoCanMessage: input.targetWhoCanMessage,
    targetProfileVisibility: input.targetProfileVisibility,
    targetStoryVisibility: input.targetStoryVisibility,
    membership: input.membership || "free",
    walletEnabled: input.walletEnabled !== false,
    entitlements: input.entitlements,
    identityVerified: input.identityVerified,
    marketplaceEnabled: input.marketplaceEnabled !== false,
    communityJoinPolicy: input.communityJoinPolicy,
    isCommunityMember: input.isCommunityMember,
    canInviteToCommunity: input.canInviteToCommunity,
  }
}
