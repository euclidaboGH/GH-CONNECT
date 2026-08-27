"use client"

import { useState, useMemo, useCallback, memo } from "react"
import {
  X,
  Users,
  UserCheck,
  Shield,
  FileText,
  Images,
  ChevronDown,
  ChevronUp,
  Share2,
  Bell,
  BellOff,
  LogOut,
  Lock,
  Calendar,
} from "lucide-react"
import type { Conversation } from "@/lib/ghc-types"

interface GroupInfoPageProps {
  group: Conversation
  currentUserId: string
  onClose: () => void
  onMemberClick?: (userId: string) => void
  onToggleMute?: (muted: boolean) => void
  onViewSharedMedia?: () => void
  onLeaveGroup?: () => void
  /** Promote member to admin (owner/admin only) */
  onPromoteMember?: (userId: string) => void
  /** Demote admin to member */
  onDemoteMember?: (userId: string) => void
  /** Remove member from group */
  onRemoveMember?: (userId: string) => void
}

// Memoized member stat card component
const MemberStatCard = memo(
  ({
    value,
    label,
    color,
  }: {
    value: number | string
    label: string
    color: "primary" | "green" | "blue"
  }) => {
    const colorClasses = {
      primary: "bg-primary/10 dark:bg-primary/20 text-primary",
      green: "bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400",
      blue: "bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400",
    }

    return (
      <div className={`${colorClasses[color]} rounded-lg p-3 text-center`}>
        <div className="text-lg font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    )
  }
)
MemberStatCard.displayName = "MemberStatCard"

// Memoized action button component
const ActionButton = memo(
  ({
    icon: Icon,
    label,
    onClick,
    variant = "secondary",
  }: {
    icon: React.ComponentType<{ size: number }>
    label: string
    onClick?: () => void
    variant?: "secondary" | "danger"
  }) => {
    const variantClasses = {
      secondary: "bg-gray-100 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800",
      danger: "bg-red-500/10 hover:bg-red-500/20 dark:hover:bg-red-500/20",
    }

    return (
      <button
        onClick={onClick}
        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg ${variantClasses[variant]} transition-colors text-sm font-medium`}
      >
        <Icon size={16} />
        {label}
      </button>
    )
  }
)
ActionButton.displayName = "ActionButton"

// Memoized member item component
const MemberItem = memo(
  ({
    userId,
    isAdmin,
    isOwner,
    canManage,
    onClick,
    onPromote,
    onDemote,
    onRemove,
  }: {
    userId: string
    isAdmin: boolean
    isOwner?: boolean
    canManage?: boolean
    onClick?: (userId: string) => void
    onPromote?: (userId: string) => void
    onDemote?: (userId: string) => void
    onRemove?: (userId: string) => void
  }) => {
    return (
      <div className="flex w-full items-center gap-2 rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-900">
        <button
          type="button"
          onClick={() => onClick?.(userId)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left transition-colors"
        >
          <div
            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              isAdmin
                ? "bg-primary/20 text-primary"
                : "bg-blue-500/20 text-blue-600 dark:text-blue-400"
            }`}
          >
            {userId.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              User {userId.slice(0, 6)}
              {isOwner ? " · Owner" : isAdmin ? " · Admin" : ""}
            </p>
          </div>
          <div className="h-2 w-2 rounded-full bg-green-500" />
        </button>
        {canManage && !isOwner && (
          <div className="flex shrink-0 gap-1">
            {isAdmin ? (
              <button
                type="button"
                onClick={() => onDemote?.(userId)}
                className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-200"
              >
                Demote
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onPromote?.(userId)}
                className="rounded-md bg-purple-50 px-2 py-1 text-[10px] font-bold text-purple-700 hover:bg-purple-100"
              >
                Promote
              </button>
            )}
            <button
              type="button"
              onClick={() => onRemove?.(userId)}
              className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-100"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    )
  }
)
MemberItem.displayName = "MemberItem"

// Memoized members section
const MembersSection = memo(
  ({
    expanded,
    onToggle,
    admins,
    members,
    ownerId,
    canManage,
    onMemberClick,
    onPromote,
    onDemote,
    onRemove,
  }: {
    expanded: boolean
    onToggle: () => void
    admins: string[]
    members: string[]
    ownerId?: string
    canManage?: boolean
    onMemberClick?: (userId: string) => void
    onPromote?: (userId: string) => void
    onDemote?: (userId: string) => void
    onRemove?: (userId: string) => void
  }) => {
    const totalMembers = admins.length + members.length

    return (
      <div className="border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Users size={18} className="text-primary" />
            <span className="font-semibold text-foreground">Members ({totalMembers})</span>
          </div>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-3 max-h-72 overflow-y-auto">
            {admins.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <Shield size={14} /> Admins ({admins.length})
                </p>
                <div className="space-y-1">
                  {admins.slice(0, 8).map((adminId) => (
                    <MemberItem
                      key={adminId}
                      userId={adminId}
                      isAdmin={true}
                      isOwner={adminId === ownerId}
                      canManage={canManage}
                      onClick={onMemberClick}
                      onPromote={onPromote}
                      onDemote={onDemote}
                      onRemove={onRemove}
                    />
                  ))}
                  {admins.length > 8 && (
                    <p className="text-xs text-muted-foreground px-2 py-1">
                      +{admins.length - 8} more admin{admins.length - 8 !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
            )}

            {members.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  Members ({members.length})
                </p>
                <div className="space-y-1">
                  {members.slice(0, 8).map((memberId) => (
                    <MemberItem
                      key={memberId}
                      userId={memberId}
                      isAdmin={false}
                      canManage={canManage}
                      onClick={onMemberClick}
                      onPromote={onPromote}
                      onDemote={onDemote}
                      onRemove={onRemove}
                    />
                  ))}
                  {members.length > 8 && (
                    <p className="text-xs text-muted-foreground px-2 py-1">
                      +{members.length - 8} more member{members.length - 8 !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
)
MembersSection.displayName = "MembersSection"

export function GroupInfoPage({
  group,
  currentUserId,
  onClose,
  onMemberClick,
  onToggleMute,
  onViewSharedMedia,
  onLeaveGroup,
  onPromoteMember,
  onDemoteMember,
  onRemoveMember,
}: GroupInfoPageProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    members: true,
    rules: false,
    media: false,
  })

  // Memoized member stats with online count
  const memberStats = useMemo(() => {
    if (!group.members) return { total: 0, online: 0, admins: [], regularMembers: [] }

    const admins = (group.members || []).filter(
      (id) => group.groupRoles?.[id] === "admin" || id === group.createdBy
    )
    const regularMembers = (group.members || []).filter(
      (id) => group.groupRoles?.[id] !== "admin" && id !== group.createdBy
    )
    // Simulate online members (60% of total, or at least 1)
    const onlineCount = Math.max(1, Math.ceil(group.members.length * 0.6))

    return {
      total: group.members.length,
      online: onlineCount,
      admins,
      regularMembers,
    }
  }, [group.members, group.groupRoles, group.createdBy])

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }, [])

  const isUserAdmin =
    group.groupRoles?.[currentUserId] === "admin" || group.createdBy === currentUserId

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-hidden flex">
      {/* Slide-in panel from right */}
      <div className="ml-auto w-full max-w-md h-full bg-white dark:bg-gray-950 shadow-2xl flex flex-col animate-in slide-in-from-right">
        {/* Header - Fixed */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-950 z-10">
          <h2 className="text-lg font-bold text-foreground">Group Info</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg transition-colors"
            aria-label="Close group info"
          >
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Cover Photo Section - Optimized */}
          {group.groupPhoto && (
            <div className="relative w-full aspect-video bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden">
              <img
                src={group.groupPhoto}
                alt={group.groupName || "Group cover"}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}

          {/* Group Header Section */}
          <div className="p-4 space-y-4 border-b border-gray-200 dark:border-gray-800">
            {/* Title & Category */}
            <div>
              <h1 className="text-2xl font-bold text-foreground line-clamp-2">{group.groupName}</h1>
              {group.category && (
                <p className="text-sm text-muted-foreground capitalize mt-1">
                  {group.category.replace("-", " ")}
                </p>
              )}
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-2">
              <MemberStatCard value={memberStats.total} label="Members" color="primary" />
              <MemberStatCard value={memberStats.admins.length} label="Admins" color="green" />
              <MemberStatCard value={memberStats.online} label="Online" color="blue" />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <ActionButton
                icon={group.isMuted ? Bell : BellOff}
                label={group.isMuted ? "Unmute" : "Mute"}
                onClick={() => onToggleMute?.(!group.isMuted)}
              />
              <ActionButton
                icon={Images}
                label="Media"
                onClick={onViewSharedMedia}
              />
              <ActionButton
                icon={Share2}
                label="Share"
                onClick={() =>
                  navigator.share?.({ title: group.groupName, text: group.description })
                }
              />
            </div>
          </div>

          {/* Description Section */}
          {group.description && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-semibold text-sm text-foreground mb-2">About</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{group.description}</p>
            </div>
          )}

          {/* Members Section - Using memoized component */}
          <MembersSection
            expanded={expandedSections.members}
            onToggle={() => toggleSection("members")}
            admins={memberStats.admins}
            members={memberStats.regularMembers}
            ownerId={group.createdBy}
            canManage={isUserAdmin}
            onMemberClick={onMemberClick}
            onPromote={onPromoteMember}
            onDemote={onDemoteMember}
            onRemove={onRemoveMember}
          />

          {/* Rules Section */}
          {group.rules && group.rules.length > 0 && (
            <div className="border-b border-gray-200 dark:border-gray-800">
              <button
                onClick={() => toggleSection("rules")}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-amber-600 dark:text-amber-400" />
                  <span className="font-semibold text-foreground">
                    Rules ({group.rules.length})
                  </span>
                </div>
                {expandedSections.rules ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              {expandedSections.rules && (
                <div className="px-4 pb-4 space-y-2 max-h-64 overflow-y-auto">
                  {group.rules.map((rule, index) => (
                    <div
                      key={index}
                      className="flex gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900"
                    >
                      <div className="text-sm font-bold text-amber-700 dark:text-amber-300 flex-shrink-0">
                        {index + 1}.
                      </div>
                      <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed">
                        {rule}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Shared Media Section */}
          <div className="border-b border-gray-200 dark:border-gray-800">
            <button
              onClick={() => toggleSection("media")}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Images size={18} className="text-purple-600 dark:text-purple-400" />
                <span className="font-semibold text-foreground">Shared Media</span>
              </div>
              {expandedSections.media ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {expandedSections.media && (
              <div className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square bg-gradient-to-br from-purple-200 to-purple-100 dark:from-purple-900 dark:to-purple-800 rounded-lg flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <Images size={20} className="text-purple-600 dark:text-purple-400" />
                    </div>
                  ))}
                </div>
                <button
                  onClick={onViewSharedMedia}
                  className="w-full py-2 text-sm font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors"
                >
                  View All Media
                </button>
              </div>
            )}
          </div>

          {/* Group Information */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock size={16} />
                Privacy
              </span>
              <span className="text-sm font-semibold text-foreground capitalize">
                {group.privacy || "Public"}
              </span>
            </div>
            {group.createdAt && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar size={16} />
                  Created
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {new Date(group.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions - Fixed */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-900/50 space-y-2">
          {isUserAdmin && (
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors font-medium text-sm">
              <Shield size={16} />
              Manage Group
            </button>
          )}
          <button
            onClick={onLeaveGroup}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors font-medium text-sm"
          >
            <LogOut size={16} />
            Leave Group
          </button>
        </div>
      </div>

      {/* Backdrop close handler */}
      <div className="flex-1 cursor-pointer" onClick={onClose} />
    </div>
  )
}
