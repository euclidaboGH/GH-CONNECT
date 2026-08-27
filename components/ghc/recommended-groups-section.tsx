"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { SuggestedGroupsCard } from "./suggested-groups-card"
import type { GroupRecommendation } from "@/lib/group-recommendation-engine"
import { generateGroupRecommendations, invalidateRecommendationCache } from "@/lib/group-recommendation-engine"
import type { Profile, Settings } from "@/lib/ghc-types"

interface RecommendedGroupsSectionProps {
  profile: Profile
  settings: Settings
  allGroups: Array<{
    id: string
    name: string
    description: string
    icon: string
    category: string
    members: number
    onlineMembers: number
    city: string
    country: string
    interests: string[]
    messageCount24h: number
    createdAt: number
    lastActivity: number
  }>
  joinedGroupIds: string[]
  onJoinGroup: (groupId: string) => Promise<void>
  onViewGroup: (groupId: string) => void
  onJoinSuccess?: (groupId: string, groupName: string) => void
}

export function RecommendedGroupsSection({
  profile,
  settings,
  allGroups,
  joinedGroupIds,
  onJoinGroup,
  onViewGroup,
  onJoinSuccess,
}: RecommendedGroupsSectionProps) {
  const [recommendations, setRecommendations] = useState<GroupRecommendation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joinedStates, setJoinedStates] = useState<Set<string>>(new Set(joinedGroupIds))

  // Memoize recommendations generation - only when dependencies truly change
  const memoizedRecommendations = useMemo(() => {
    if (!profile.interests || profile.interests.length === 0 || !allGroups.length) {
      return []
    }

    try {
      // Performance optimization: use shallow comparison for profile and settings
      const recs = generateGroupRecommendations(profile, settings, allGroups, Array.from(joinedStates))
      // Limit initial render to first 4, then expand
      return recs
    } catch (err) {
      console.error("[v0] Recommendation generation error:", err)
      setError("Failed to generate recommendations. Please try again.")
      return []
    }
  }, [profile.interests, profile.city, profile.country, settings.locationRadius, allGroups.length, joinedStates])

  // Generate recommendations on mount or when data changes
  useEffect(() => {
    const loadRecommendations = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Minimal async delay for state consistency (100ms instead of 300ms for faster perceived load)
        await new Promise((resolve) => setTimeout(resolve, 100))

        if (memoizedRecommendations.length === 0 && profile.interests.length === 0) {
          setError("Add interests to see recommended groups")
        } else if (memoizedRecommendations.length === 0) {
          setError("No groups match your interests right now")
        } else {
          setRecommendations(memoizedRecommendations)
        }
      } catch (err) {
        setError("Failed to load recommendations")
        console.error("[v0] Failed to load recommendations:", err)
      } finally {
        setIsLoading(false)
      }
    }

    loadRecommendations()
  }, [memoizedRecommendations, profile.interests.length])

  // Handle group join with optimistic updates
  const handleJoinGroup = useCallback(
    async (groupId: string) => {
      try {
        // Optimistic update
        const newJoinedStates = new Set(joinedStates)
        newJoinedStates.add(groupId)
        setJoinedStates(newJoinedStates)

        // Call parent handler
        await onJoinGroup(groupId)

        // Find group name for callback
        const rec = recommendations.find((r) => r.groupId === groupId)
        if (rec && onJoinSuccess) {
          onJoinSuccess(groupId, rec.groupName)
        }

        // Invalidate cache to get fresh recommendations
        invalidateRecommendationCache()
      } catch (err) {
        // Revert optimistic update on error
        const newJoinedStates = new Set(joinedStates)
        newJoinedStates.delete(groupId)
        setJoinedStates(newJoinedStates)

        console.error("[v0] Failed to join group:", err)
      }
    },
    [joinedStates, recommendations, onJoinGroup, onJoinSuccess]
  )

  // No profile data yet
  if (!profile.city || !profile.interests || profile.interests.length === 0) {
    return (
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 text-center">
        <AlertCircle className="w-6 h-6 text-blue-600 mx-auto mb-2" />
        <h3 className="font-bold text-sm text-blue-900 mb-1">Complete Your Profile</h3>
        <p className="text-xs text-blue-700">Add your location and interests to see group recommendations</p>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin mr-2" />
        <span className="text-sm text-gray-600">Finding great groups for you...</span>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 text-center">
        <p className="text-xs text-amber-800">{error}</p>
      </div>
    )
  }

  // No recommendations
  if (recommendations.length === 0) {
    return (
      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 text-center">
        <p className="text-sm text-gray-600 font-medium">No groups match your interests yet</p>
        <p className="text-xs text-gray-500 mt-1">Try updating your interests or location</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="px-4 py-2 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-sm text-gray-900">Suggested Groups</h2>
          <p className="text-xs text-gray-500">
            {recommendations.length} group{recommendations.length !== 1 ? "s" : ""} recommended based on your interests, location & activity
          </p>
        </div>
      </div>

      {/* Groups grid - 2 col on mobile, 3 col on larger screens - optimized for performance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4">
        {recommendations.map((rec) => (
          <SuggestedGroupsCard
            key={rec.groupId}
            groupId={rec.groupId}
            groupName={rec.groupName}
            description={rec.description}
            icon={rec.icon}
            category={rec.category}
            members={rec.members}
            onlineMembers={rec.onlineMembers}
            matchType={rec.matchType}
            score={rec.score}
            reasons={rec.reasons}
            activity={rec.activity}
            distanceKm={rec.distanceKm}
            matchingInterests={rec.matchingInterests}
            isTrending={rec.isTrending}
            onJoin={handleJoinGroup}
            onView={onViewGroup}
            isJoined={joinedStates.has(rec.groupId)}
            isLoading={false}
          />
        ))}
      </div>
    </div>
  )
}
