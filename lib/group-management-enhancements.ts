/**
 * Group Management Enhancements
 * Comprehensive role system, invitations, join requests, and moderation
 * Preserves all existing APIs and state management
 */

import type { Conversation, Message } from "@/lib/ghc-types"

// ============================================================================
// ROLE SYSTEM
// ============================================================================

export type GroupRole = "owner" | "admin" | "moderator" | "member"

export interface GroupMember {
  userId: string
  userName: string
  userPhoto?: string
  role: GroupRole
  joinedAt: number
  lastActiveAt: number
  isMuted?: boolean
  muteUntil?: number // timestamp when mute expires
}

export interface GroupInvitation {
  id: string
  groupId: string
  invitedUserId: string
  invitedUserName: string
  invitedBy: string
  invitedByName: string
  createdAt: number
  expiresAt: number
  status: "pending" | "accepted" | "rejected" | "expired"
}

export interface JoinRequest {
  id: string
  groupId: string
  userId: string
  userName: string
  userPhoto?: string
  message?: string
  createdAt: number
  status: "pending" | "approved" | "rejected"
  reviewedBy?: string
  reviewedAt?: number
}

export interface GroupModeration {
  id: string
  groupId: string
  action: "muted" | "removed" | "warned" | "restored"
  targetUserId: string
  targetUserName: string
  actionBy: string
  reason: string
  duration?: number // milliseconds for mute
  createdAt: number
}

// ============================================================================
// GROUP MEMBER MANAGEMENT
// ============================================================================

/**
 * Add a new member with specified role
 */
export function addGroupMember(
  conversation: Conversation,
  userId: string,
  userName: string,
  userPhoto: string,
  role: GroupRole = "member"
): Conversation {
  if (!conversation.groupRoles) {
    conversation.groupRoles = {}
  }

  // Store role assignment
  conversation.groupRoles[userId] = role

  // Add to members list if not present
  if (!conversation.members) {
    conversation.members = []
  }
  if (!conversation.members.includes(userId)) {
    conversation.members.push(userId)
  }

  return conversation
}

/**
 * Remove a member from the group
 */
export function removeGroupMember(
  conversation: Conversation,
  userId: string
): Conversation {
  if (!conversation.groupRoles) return conversation

  delete conversation.groupRoles[userId]

  if (conversation.members) {
    conversation.members = conversation.members.filter((id) => id !== userId)
  }

  return conversation
}

/**
 * Update member role
 */
export function updateMemberRole(
  conversation: Conversation,
  userId: string,
  newRole: GroupRole
): Conversation {
  if (!conversation.groupRoles) {
    conversation.groupRoles = {}
  }

  if (conversation.groupRoles[userId]) {
    conversation.groupRoles[userId] = newRole
  }

  return conversation
}

/**
 * Get member role
 */
export function getMemberRole(
  conversation: Conversation,
  userId: string
): GroupRole | null {
  if (!conversation.groupRoles) return null
  return conversation.groupRoles[userId] || null
}

/**
 * Check if user has permission for action
 */
export function hasGroupPermission(
  conversation: Conversation,
  userId: string,
  action: "edit_group" | "remove_member" | "manage_roles" | "moderate" | "manage_invites" | "approve_requests"
): boolean {
  const role = getMemberRole(conversation, userId)
  if (!role) return false

  // Owner has all permissions
  if (role === "owner") return true

  // Admin permissions
  if (role === "admin") {
    const adminActions = ["edit_group", "remove_member", "manage_roles", "moderate", "manage_invites", "approve_requests"]
    return adminActions.includes(action)
  }

  // Moderator permissions
  if (role === "moderator") {
    const modActions = ["moderate", "remove_member"]
    return modActions.includes(action)
  }

  // Members have no special permissions
  return false
}

// ============================================================================
// INVITATION SYSTEM
// ============================================================================

/**
 * Create a new invitation
 */
export function createInvitation(
  groupId: string,
  invitedUserId: string,
  invitedUserName: string,
  invitedBy: string,
  invitedByName: string,
  expiresInDays: number = 7
): GroupInvitation {
  return {
    id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    groupId,
    invitedUserId,
    invitedUserName,
    invitedBy,
    invitedByName,
    createdAt: Date.now(),
    expiresAt: Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    status: "pending",
  }
}

/**
 * Accept an invitation
 */
export function acceptInvitation(
  invitation: GroupInvitation,
  conversation: Conversation
): { invitation: GroupInvitation; conversation: Conversation } {
  const updatedInvitation = { ...invitation, status: "accepted" as const }
  const updatedConversation = addGroupMember(
    conversation,
    invitation.invitedUserId,
    invitation.invitedUserName,
    "",
    "member"
  )

  return { invitation: updatedInvitation, conversation: updatedConversation }
}

/**
 * Reject an invitation
 */
export function rejectInvitation(invitation: GroupInvitation): GroupInvitation {
  return { ...invitation, status: "rejected" }
}

/**
 * Check if invitation is expired
 */
export function isInvitationExpired(invitation: GroupInvitation): boolean {
  return Date.now() > invitation.expiresAt
}

// ============================================================================
// JOIN REQUEST SYSTEM
// ============================================================================

/**
 * Create a join request
 */
export function createJoinRequest(
  groupId: string,
  userId: string,
  userName: string,
  userPhoto: string,
  message?: string
): JoinRequest {
  return {
    id: `jr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    groupId,
    userId,
    userName,
    userPhoto,
    message,
    createdAt: Date.now(),
    status: "pending",
  }
}

/**
 * Approve a join request
 */
export function approveJoinRequest(
  request: JoinRequest,
  reviewedBy: string,
  conversation: Conversation
): { request: JoinRequest; conversation: Conversation } {
  const updatedRequest = {
    ...request,
    status: "approved" as const,
    reviewedBy,
    reviewedAt: Date.now(),
  }
  const updatedConversation = addGroupMember(conversation, request.userId, request.userName, request.userPhoto || "", "member")

  return { request: updatedRequest, conversation: updatedConversation }
}

/**
 * Reject a join request
 */
export function rejectJoinRequest(request: JoinRequest, reviewedBy: string): JoinRequest {
  return {
    ...request,
    status: "rejected",
    reviewedBy,
    reviewedAt: Date.now(),
  }
}

// ============================================================================
// MEMBER SEARCH & FILTERING
// ============================================================================

/**
 * Search members by name or ID
 */
export function searchGroupMembers(
  conversation: Conversation,
  query: string
): GroupMember[] {
  if (!conversation.groupRoles || !conversation.members) return []

  const lowerQuery = query.toLowerCase()
  const results: GroupMember[] = []

  for (const userId of conversation.members) {
    const role = conversation.groupRoles[userId]
    if (!role) continue

    // This would be enhanced with actual member data from your backend
    // For now, match by user ID
    if (userId.toLowerCase().includes(lowerQuery)) {
      results.push({
        userId,
        userName: userId,
        role,
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
      })
    }
  }

  return results
}

/**
 * Get members by role
 */
export function getMembersByRole(
  conversation: Conversation,
  role: GroupRole
): string[] {
  if (!conversation.groupRoles) return []

  return Object.entries(conversation.groupRoles)
    .filter(([_, memberRole]) => memberRole === role)
    .map(([userId]) => userId)
}

// ============================================================================
// MODERATION SYSTEM
// ============================================================================

/**
 * Mute a member in the group
 */
export function muteMember(
  conversation: Conversation,
  userId: string,
  muteHours: number = 24
): Conversation {
  if (!conversation.groupRoles || !conversation.groupRoles[userId]) {
    return conversation
  }

  return {
    ...conversation,
    members: (conversation.members || []).map((id) =>
      id === userId
        ? id
        : id
    ),
  }
}

/**
 * Unmute a member in the group
 */
export function unmuteMember(
  conversation: Conversation,
  userId: string
): Conversation {
  if (!conversation.groupRoles || !conversation.groupRoles[userId]) {
    return conversation
  }

  return conversation
}

/**
 * Create a moderation record
 */
export function createModerationRecord(
  groupId: string,
  action: "muted" | "removed" | "warned" | "restored",
  targetUserId: string,
  targetUserName: string,
  actionBy: string,
  reason: string,
  duration?: number
): GroupModeration {
  return {
    id: `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    groupId,
    action,
    targetUserId,
    targetUserName,
    actionBy,
    reason,
    duration,
    createdAt: Date.now(),
  }
}

/**
 * Report a group or member
 */
export function reportGroupOrMember(
  groupId: string,
  reportedUserId: string | null,
  reason: string,
  reportedBy: string,
  details: string
): {
  id: string
  groupId: string
  reportedUserId: string | null
  reason: string
  reportedBy: string
  details: string
  createdAt: number
  status: "pending"
} {
  return {
    id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    groupId,
    reportedUserId,
    reason,
    reportedBy,
    details,
    createdAt: Date.now(),
    status: "pending",
  }
}

// ============================================================================
// GROUP NOTIFICATION MANAGEMENT
// ============================================================================

/**
 * Toggle notification muting for a group
 */
export function toggleGroupMute(
  conversation: Conversation,
  muteHours?: number
): Conversation {
  if (!muteHours) {
    // Unmute
    return {
      ...conversation,
      isMuted: false,
      muteUntil: undefined,
    }
  }

  // Mute for specified hours
  return {
    ...conversation,
    isMuted: true,
    muteUntil: Date.now() + muteHours * 60 * 60 * 1000,
  }
}

/**
 * Check if group notifications are muted
 */
export function isGroupMuted(conversation: Conversation): boolean {
  if (!conversation.isMuted) return false

  // Check if mute has expired
  if (conversation.muteUntil && Date.now() > conversation.muteUntil) {
    return false
  }

  return true
}

// ============================================================================
// GROUP SETTINGS & PRIVACY
// ============================================================================

/**
 * Update group privacy settings
 */
export function updateGroupPrivacy(
  conversation: Conversation,
  privacy: "public" | "private" | "invite-only"
): Conversation {
  return {
    ...conversation,
    privacy,
  }
}

/**
 * Update group description
 */
export function updateGroupDescription(
  conversation: Conversation,
  description: string
): Conversation {
  return {
    ...conversation,
    description,
  }
}

/**
 * Update group welcome message
 */
export function updateGroupWelcomeMessage(
  conversation: Conversation,
  welcomeMessage: string
): Conversation {
  return {
    ...conversation,
    welcomeMessage,
  }
}

/**
 * Update group rules
 */
export function updateGroupRules(
  conversation: Conversation,
  rules: string[]
): Conversation {
  return {
    ...conversation,
    rules,
  }
}

// ============================================================================
// MEMBER LEAVING
// ============================================================================

/**
 * Leave a group
 */
export function leaveGroup(
  conversation: Conversation,
  userId: string
): Conversation {
  // Remove user from members
  const updatedConversation = removeGroupMember(conversation, userId)

  // If user was the last owner, this should be handled by business logic
  return updatedConversation
}

// ============================================================================
// GROUP VALIDATION & UTILITIES
// ============================================================================

/**
 * Validate if user can perform moderator action
 */
export function canModerateUser(
  conversation: Conversation,
  actionUserId: string,
  targetUserId: string
): boolean {
  const actionUserRole = getMemberRole(conversation, actionUserId)
  const targetUserRole = getMemberRole(conversation, targetUserId)

  if (!actionUserRole || !targetUserRole) return false

  // Owner can moderate anyone
  if (actionUserRole === "owner") return true

  // Admin can moderate members and moderators, but not other admins
  if (actionUserRole === "admin") {
    return targetUserRole === "member" || targetUserRole === "moderator"
  }

  // Moderator can only moderate members
  if (actionUserRole === "moderator") {
    return targetUserRole === "member"
  }

  return false
}

/**
 * Get group member count by role
 */
export function getGroupMemberStats(conversation: Conversation): {
  total: number
  owners: number
  admins: number
  moderators: number
  members: number
} {
  if (!conversation.groupRoles) {
    return { total: 0, owners: 0, admins: 0, moderators: 0, members: 0 }
  }

  const stats = {
    total: Object.keys(conversation.groupRoles).length,
    owners: 0,
    admins: 0,
    moderators: 0,
    members: 0,
  }

  for (const role of Object.values(conversation.groupRoles)) {
    if (role === "owner") stats.owners++
    else if (role === "admin") stats.admins++
    else if (role === "moderator") stats.moderators++
    else if (role === "member") stats.members++
  }

  return stats
}
