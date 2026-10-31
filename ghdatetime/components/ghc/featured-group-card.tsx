"use client"

import { memo } from "react"
import { Users } from "lucide-react"

interface FeaturedGroupCardProps {
  id: string
  name: string
  description: string
  icon: string
  category: string
  members: number
  onlineMembers?: number
  coverImage?: string
  isJoined: boolean
  onJoin: () => void
  lastMessage?: string
  unreadCount?: number
  lastMessageTime?: number
}

function FeaturedGroupCardContent({
  id,
  name,
  description,
  icon,
  category,
  members,
  onlineMembers = 0,
  coverImage,
  isJoined,
  onJoin,
  lastMessage = "",
  unreadCount = 0,
  lastMessageTime = Date.now(),
}: FeaturedGroupCardProps) {
  return (
    <div className="relative rounded-xl overflow-hidden bg-card shadow-md hover:shadow-lg transition-shadow border border-border/70/50">
      {/* Cover Image */}
      <div className="relative h-40 bg-gradient-to-br from-emerald-600 to-teal-700 overflow-hidden">
        {coverImage ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${coverImage})` }}
            />
            <div className="absolute inset-0 bg-black/20" />
          </>
        ) : (
          <div className="absolute inset-0 opacity-10 text-8xl flex items-center justify-center">
            {icon}
          </div>
        )}

        {/* Category Badge */}
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 text-xs font-semibold text-foreground backdrop-blur-sm">
            {icon} {category && category.length > 0 ? category.charAt(0).toUpperCase() + category.slice(1) : "Other"}
          </span>
        </div>

        {/* Members count overlay */}
        <div className="absolute bottom-3 right-3">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/90 text-xs font-semibold text-foreground backdrop-blur-sm">
            <Users size={14} />
            <span>{members.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="mb-3">
          {/* Title and icon */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <span className="text-2xl flex-shrink-0">{icon}</span>
              <h3 className="font-bold text-foreground line-clamp-2">{name}</h3>
            </div>
            {unreadCount > 0 && (
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--gh-green)] flex items-center justify-center text-white text-xs font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </div>
            )}
          </div>
          
          {/* Description */}
          <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
        </div>

        {/* Member stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          <span className="font-medium">{members.toLocaleString()} members</span>
          {onlineMembers > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              <span className="font-medium text-green-600">{onlineMembers} online</span>
            </span>
          )}
        </div>

        {/* Last message section */}
        {lastMessage && (
          <div className="p-2.5 rounded bg-muted/40 border border-border/70 mb-3">
            <p className="text-xs text-foreground/90 line-clamp-2">{lastMessage}</p>
          </div>
        )}

        {/* Footer with button */}
        <button
          onClick={onJoin}
          disabled={isJoined}
          className={`w-full px-4 py-2 rounded-lg font-semibold text-sm transition active:scale-95 ${
            isJoined
              ? "bg-muted text-muted-foreground cursor-default"
              : "bg-[var(--gh-green)] text-white hover:brightness-105 active:brightness-95"
          }`}
          aria-label={isJoined ? `Joined ${name}` : `Join ${name}`}
        >
          {isJoined ? "Joined" : "Join"}
        </button>
      </div>
    </div>
  )
}

export const FeaturedGroupCard = memo(FeaturedGroupCardContent)
FeaturedGroupCard.displayName = "FeaturedGroupCard"

