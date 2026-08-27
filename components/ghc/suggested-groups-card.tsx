"use client"

import { memo, useState } from "react"
import { MapPin, TrendingUp, Zap, Flame, Heart, Users, CheckCircle, Info } from "lucide-react"
import type { GroupRecommendation } from "@/lib/group-recommendation-engine"

interface SuggestedGroupsCardProps extends GroupRecommendation {
  onJoin: (groupId: string) => Promise<void>
  onView: (groupId: string) => void
  isJoined?: boolean
  isLoading?: boolean
}

const MATCH_TYPE_CONFIG = {
  interests: {
    label: "Your Interest",
    bgColor: "bg-blue-50 border-blue-200",
    badgeBg: "bg-blue-100 text-blue-700",
    buttonColor: "bg-blue-500 hover:bg-blue-600 text-white",
    icon: Heart,
    pillColor: "bg-blue-100",
  },
  activity: {
    label: "Trending Now",
    bgColor: "bg-orange-50 border-orange-200",
    badgeBg: "bg-orange-100 text-orange-700",
    buttonColor: "bg-orange-500 hover:bg-orange-600 text-white",
    icon: Flame,
    pillColor: "bg-orange-100",
  },
  nearby: {
    label: "Near You",
    bgColor: "bg-purple-50 border-purple-200",
    badgeBg: "bg-purple-100 text-purple-700",
    buttonColor: "bg-purple-500 hover:bg-purple-600 text-white",
    icon: MapPin,
    pillColor: "bg-purple-100",
  },
}

const SuggestedGroupsCardComponent = ({
  groupId,
  groupName,
  description,
  icon,
  category,
  members,
  onlineMembers,
  matchType,
  score,
  reasons,
  activity,
  matchingInterests,
  isTrending,
  onJoin,
  onView,
  isJoined = false,
  isLoading = false,
}: SuggestedGroupsCardProps) => {
  const [isJoining, setIsJoining] = useState(false)
  const [hasJoined, setHasJoined] = useState(isJoined)
  const config = MATCH_TYPE_CONFIG[matchType]
  const IconComponent = config.icon
  const activityBg = activity === "high" ? "bg-green-50" : activity === "medium" ? "bg-yellow-50" : "bg-gray-50"
  const activityText = activity === "high" ? "text-red-600" : activity === "medium" ? "text-amber-600" : "text-gray-500"

  const handleJoinClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (hasJoined || isJoining) return

    setIsJoining(true)
    try {
      await onJoin(groupId)
      setHasJoined(true)
    } catch (error) {
      console.error("[v0] Join failed:", error)
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <div className={`p-4 rounded-xl border-2 flex flex-col gap-3 hover:shadow-lg hover:scale-105 transition-all ${config.bgColor}`}>
      {/* Header: Icon, name and match badge */}
      <div className="flex items-start gap-3 justify-between">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className="text-4xl flex-shrink-0">{icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h3 className="font-bold text-sm text-gray-900 truncate">{groupName}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap flex-shrink-0 ${config.badgeBg}`}>
                {config.label}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-gray-600">{category}</p>
              {score >= 0.8 && <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-semibold">Excellent match</span>}
              {score >= 0.6 && score < 0.8 && <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold">Great match</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-700 line-clamp-2">{description}</p>

      {/* Why recommended - show reasons with icons and match strength */}
      <div className="space-y-1.5 bg-white/60 rounded-lg p-2.5 backdrop-blur-sm border border-gray-100">
        <div className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
          <Info size={14} className={`flex-shrink-0 ${score >= 0.8 ? "text-green-500" : score >= 0.6 ? "text-blue-500" : "text-gray-400"}`} />
          <span>Why recommended:</span>
          {score >= 0.8 && <span className="ml-auto text-green-600 text-xs font-bold">Strong match</span>}
        </div>
        {reasons.slice(0, 3).map((reason, idx) => (
          <div key={idx} className="flex items-start gap-2 text-xs text-gray-700">
            <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${config.pillColor}`} />
            <span className="leading-snug">{reason}</span>
          </div>
        ))}
        {reasons.length > 3 && <p className="text-xs text-gray-500 italic">+ {reasons.length - 3} more reason{reasons.length - 3 > 1 ? "s" : ""}</p>}
      </div>

      {/* Matching interests pills - when available */}
      {matchingInterests && matchingInterests.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {matchingInterests.slice(0, 3).map((interest, idx) => (
            <span
              key={idx}
              className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${config.pillColor} text-gray-700`}
            >
              {interest}
            </span>
          ))}
          {matchingInterests.length > 3 && (
            <span className="text-xs px-2 py-1 rounded-full font-medium text-gray-500">
              +{matchingInterests.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Member stats and activity - compact row */}
      <div className="flex items-center gap-3 text-xs text-gray-600 bg-gray-50/60 rounded-lg p-2">
        <div className="flex items-center gap-1.5 flex-1">
          <Users className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
          <span className="font-medium">{members.toLocaleString()}</span>
          <span className="text-gray-500">total</span>
        </div>
        {onlineMembers > 0 && (
          <div className="flex items-center gap-1.5 bg-white/60 rounded px-2 py-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
            <span className="text-green-700 font-semibold">{onlineMembers}</span>
            <span className="text-gray-600">online</span>
          </div>
        )}
      </div>

      {/* Activity indicator - enhanced visual */}
      <div className={`px-3 py-2 rounded-lg flex items-center gap-2 font-medium text-xs ${activityBg}`}>
        {activity === "high" && <Flame className={`w-4 h-4 flex-shrink-0 ${activityText}`} />}
        {activity === "medium" && <TrendingUp className={`w-4 h-4 flex-shrink-0 ${activityText}`} />}
        {activity === "low" && <Zap className={`w-4 h-4 flex-shrink-0 ${activityText}`} />}
        <span className="capitalize text-gray-700">{activity} activity</span>
        {isTrending && <span className="ml-auto">🔥 Trending</span>}
      </div>

      {/* Quick action buttons - optimized for mobile */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleJoinClick}
          disabled={hasJoined || isJoining}
          className={`px-3 py-2.5 text-xs font-bold rounded-lg transition-all active:scale-95 flex-1 flex items-center justify-center gap-1.5 ${
            hasJoined
              ? "bg-green-100 text-green-700 cursor-default"
              : isJoining
                ? "bg-gray-200 text-gray-600 cursor-wait"
                : config.buttonColor
          }`}
          aria-label={hasJoined ? `Joined ${groupName}` : `Join ${groupName}`}
        >
          {hasJoined && <CheckCircle size={14} className="flex-shrink-0" />}
          {hasJoined ? "Joined" : isJoining ? "Joining..." : "Join Now"}
        </button>

        <button
          onClick={() => onView(groupId)}
          className="px-3 py-2.5 text-xs font-bold border-2 border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all active:scale-95 text-gray-700 flex-1"
          aria-label={`Open ${groupName}`}
        >
          View Details
        </button>
      </div>
    </div>
  )
}

export const SuggestedGroupsCard = memo(SuggestedGroupsCardComponent)
