"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, TrendingUp, Users, Eye, Share2 } from "lucide-react"
import type { ProfileAnalytics, FollowerInsight, Achievement } from "@/lib/profile-enhancements"
import { ACHIEVEMENTS, formatActivityTime, SOCIAL_PLATFORMS } from "@/lib/profile-enhancements"

// ===== PROFILE ANALYTICS COMPONENT =====

export function ProfileAnalyticsCard({ analytics }: { analytics: any }) {
  const [expanded, setExpanded] = useState(false)

  if (!analytics) return null

  return (
    <div className="px-4 py-4 border-t border-gray-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg hover:shadow-md transition"
      >
        <div className="flex items-center gap-3">
          <Eye className="w-5 h-5 text-blue-600" />
          <div className="text-left">
            <p className="font-semibold text-gray-900">Profile Analytics</p>
            <p className="text-sm text-gray-600">{analytics.viewCount || 0} views this month</p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 p-3 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white p-3 rounded border border-gray-200">
              <p className="text-xs text-gray-600 mb-1">Total Views</p>
              <p className="text-2xl font-bold text-blue-600">{analytics.viewCount || 0}</p>
            </div>
            <div className="bg-white p-3 rounded border border-gray-200">
              <p className="text-xs text-gray-600 mb-1">Avg. Time Spent</p>
              <p className="text-2xl font-bold text-purple-600">{Math.round((analytics.avgTimeSpent || 0) / 60)}m</p>
            </div>
            <div className="bg-white p-3 rounded border border-gray-200">
              <p className="text-xs text-gray-600 mb-1">This Month</p>
              <p className="text-2xl font-bold text-green-600">{analytics.visitorsThisMonth || 0}</p>
            </div>
            <div className="bg-white p-3 rounded border border-gray-200">
              <p className="text-xs text-gray-600 mb-1">Bounce Rate</p>
              <p className="text-2xl font-bold text-orange-600">{(analytics.bounceRate || 0).toFixed(0)}%</p>
            </div>
          </div>

          {analytics.topReferrers && analytics.topReferrers.length > 0 && (
            <div className="bg-white p-3 rounded border border-gray-200">
              <p className="text-xs font-semibold text-gray-600 mb-2">Top Referrers</p>
              <div className="space-y-1">
                {analytics.topReferrers.slice(0, 3).map((ref: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-700">{ref.source}</span>
                    <span className="font-semibold text-gray-900">{ref.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ===== FOLLOWER INSIGHTS COMPONENT =====

export function FollowerInsightsCard({ insights }: { insights: any }) {
  const [expanded, setExpanded] = useState(false)

  if (!insights) return null

  return (
    <div className="px-4 py-4 border-t border-gray-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-pink-50 to-rose-50 rounded-lg hover:shadow-md transition"
      >
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-pink-600" />
          <div className="text-left">
            <p className="font-semibold text-gray-900">Follower Insights</p>
            <p className="text-sm text-gray-600">{insights.totalFollowers || 0} followers</p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 p-3 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white p-3 rounded border border-gray-200">
              <p className="text-xs text-gray-600 mb-1">Total Followers</p>
              <p className="text-2xl font-bold text-pink-600">{insights.totalFollowers || 0}</p>
            </div>
            <div className="bg-white p-3 rounded border border-gray-200">
              <p className="text-xs text-gray-600 mb-1">New This Month</p>
              <p className="text-2xl font-bold text-rose-600">+{insights.newFollowersThisMonth || 0}</p>
            </div>
          </div>

          {insights.topFollowerCountries && insights.topFollowerCountries.length > 0 && (
            <div className="bg-white p-3 rounded border border-gray-200">
              <p className="text-xs font-semibold text-gray-600 mb-2">Top Countries</p>
              <div className="space-y-1">
                {insights.topFollowerCountries.slice(0, 3).map((country: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-700">{country.country}</span>
                    <span className="font-semibold text-gray-900">{country.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {insights.ageDistribution && Object.keys(insights.ageDistribution).length > 0 && (
            <div className="bg-white p-3 rounded border border-gray-200">
              <p className="text-xs font-semibold text-gray-600 mb-2">Age Distribution</p>
              <div className="space-y-1">
                {Object.entries(insights.ageDistribution).slice(0, 3).map(([age, count]: [string, any], idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-700">{age}</span>
                    <span className="font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ===== ENHANCED ACHIEVEMENTS GRID =====

export function EnhancedAchievementsGrid({ profile, completionPercentage }: { profile: any; completionPercentage: number }) {
  const unlockedAchievements = completionPercentage >= 50 ? ["profile_complete", "verified"] : ["profile_complete"]
  const [expanded, setExpanded] = useState(false)

  const displayAchievements = expanded ? Object.values(ACHIEVEMENTS) : Object.values(ACHIEVEMENTS).slice(0, 4)

  return (
    <div className="px-4 py-4 border-t border-gray-200">
      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">Achievements</p>
      <div className="grid grid-cols-4 gap-2 mb-3 auto-rows-max">
        {displayAchievements.map((achievement) => {
          const isUnlocked = unlockedAchievements.includes(achievement.id)
          return (
            <div
              key={achievement.id}
              className={`p-3 rounded-lg text-center transition cursor-pointer ${
                isUnlocked
                  ? "bg-yellow-50 border-2 border-yellow-400 shadow-md hover:shadow-lg"
                  : "bg-gray-50 border-2 border-gray-300 opacity-60 hover:opacity-75"
              }`}
              title={achievement.description}
            >
              <div className="text-2xl mb-1">{achievement.icon}</div>
              <p className="text-xs font-bold text-gray-900 line-clamp-2">{achievement.title}</p>
              {isUnlocked && <p className="text-xs text-yellow-700 font-semibold mt-1">✓ Unlocked</p>}
            </div>
          )
        })}
      </div>

      {Object.values(ACHIEVEMENTS).length > 4 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-sm font-semibold text-purple-600 hover:text-purple-700 active:scale-95 py-2 transition"
        >
          {expanded ? "Show Less ↑" : `Show All (${Object.values(ACHIEVEMENTS).length}) ↓`}
        </button>
      )}
    </div>
  )
}

// ===== SKILLS & ENDORSEMENTS SECTION =====

export function SkillsSection({
  skills = [],
  endorsements = {},
  onSkillAdd,
  onSkillRemove,
}: {
  skills?: string[]
  endorsements?: Record<string, number>
  onSkillAdd?: (skill: string) => void
  onSkillRemove?: (skill: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [newSkill, setNewSkill] = useState("")

  if (skills.length === 0 && !onSkillAdd) return null

  return (
    <div className="px-4 py-4 border-t border-gray-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
      >
        <div className="text-left">
          <p className="font-semibold text-gray-900">Skills & Endorsements</p>
          <p className="text-sm text-gray-600">{skills.length} skills</p>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg space-y-3">
          {skills.length > 0 && (
            <div className="space-y-2">
              {skills.map((skill) => (
                <div key={skill} className="flex items-center justify-between p-2 bg-white rounded border border-blue-200">
                  <div>
                    <p className="font-semibold text-gray-900">{skill}</p>
                    <p className="text-xs text-gray-600">{endorsements?.[skill] || 0} endorsements</p>
                  </div>
                  {onSkillRemove && (
                    <button
                      onClick={() => onSkillRemove(skill)}
                      className="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded transition"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {onSkillAdd && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && newSkill.trim()) {
                    onSkillAdd(newSkill)
                    setNewSkill("")
                  }
                }}
                placeholder="Add a skill..."
                className="flex-1 px-3 py-2 border border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => {
                  if (newSkill.trim()) {
                    onSkillAdd(newSkill)
                    setNewSkill("")
                  }
                }}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded font-semibold transition active:scale-90"
              >
                Add
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ===== ENHANCED SOCIAL LINKS SECTION =====

export function EnhancedSocialLinksSection({
  socialLinks = {},
  onAddLink,
  onRemoveLink,
}: {
  socialLinks?: Record<string, any>
  onAddLink?: (platform: string) => void
  onRemoveLink?: (platform: string) => void
}) {
  // Standard platform order for consistency
  const platformOrder = ["instagram", "twitter", "linkedin", "facebook", "tiktok", "youtube", "website"]
  const platforms = platformOrder.filter((p) => p in SOCIAL_PLATFORMS)

  return (
    <div className="px-4 py-4 border-t border-gray-200">
      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-4">Social Links</p>
      <div className="space-y-2">
        {platforms.map((platform) => {
          const link = socialLinks?.[platform]
          const config = SOCIAL_PLATFORMS[platform as keyof typeof SOCIAL_PLATFORMS]
          const isLinked = !!link

          return (
            <div
              key={platform}
              className={`flex items-center gap-3 p-3 rounded-lg transition ${
                isLinked
                  ? "bg-green-50 border border-green-200 hover:bg-green-100"
                  : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              <span className="text-xl flex-shrink-0" title={config.name}>
                {config.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{config.name}</p>
                {isLinked && link?.handle && (
                  <p className="text-xs text-gray-600 truncate">@{link.handle}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isLinked ? (
                  <>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold px-3 py-1.5 rounded bg-green-500 hover:bg-green-600 text-white transition active:scale-95"
                      title={`Visit ${config.name}`}
                    >
                      View
                    </a>
                    {onRemoveLink && (
                      <button
                        onClick={() => onRemoveLink(platform)}
                        className="text-xs font-semibold px-3 py-1.5 rounded bg-red-100 hover:bg-red-200 text-red-700 transition active:scale-95"
                        title={`Remove ${config.name}`}
                      >
                        Remove
                      </button>
                    )}
                  </>
                ) : (
                  onAddLink && (
                    <button
                      onClick={() => onAddLink(platform)}
                      className="text-xs font-semibold px-3 py-1.5 rounded bg-purple-100 hover:bg-purple-200 text-purple-700 transition active:scale-95"
                      title={`Add ${config.name}`}
                    >
                      Add
                    </button>
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ===== PINNED POSTS SECTION =====

export function PinnedPostsSection({ 
  posts = [],
  pinnedPostIds = [],
  onTogglePinned 
}: { 
  posts?: any[]
  pinnedPostIds?: string[]
  onTogglePinned?: (postId: string) => void
}) {
  const pinnedCount = pinnedPostIds.length
  const maxPinned = 3
  
  return (
    <div className="px-4 py-4 border-t border-gray-200">
      <h3 className="font-bold text-gray-900 mb-3">
        📌 Pinned Posts ({pinnedCount}/{maxPinned})
      </h3>
      {pinnedCount > 0 ? (
        <div className="space-y-2 mb-3">
          {posts.filter(p => pinnedPostIds.includes(p.id)).slice(0, 3).map(post => (
            <div key={post.id} className="p-2 bg-blue-50 rounded-lg border border-blue-200 flex justify-between items-center">
              <span className="text-sm text-gray-700 truncate">{post.content?.substring(0, 40)}...</span>
              <button
                onClick={() => onTogglePinned?.(post.id)}
                className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition"
              >
                Unpin
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-600 mb-3">No pinned posts yet. Pin your best content!</p>
      )}
      <button
        onClick={() => onTogglePinned?.("")}
        className="w-full px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-semibold transition"
      >
        {pinnedCount < maxPinned ? "Pin a Post" : "Manage Pinned Posts"}
      </button>
    </div>
  )
}

// ===== QR PROFILE SHARE ENHANCED =====

export function EnhancedQRProfileShare({ 
  profileUrl = "", 
  displayName = "Profile",
  onShare 
}: { 
  profileUrl?: string
  displayName?: string
  onShare?: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(profileUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="px-4 py-4 border-t border-gray-200">
      <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg text-center">
        <p className="text-sm font-semibold text-gray-900 mb-3">Share Your Profile</p>

        {/* QR Code Placeholder */}
        <div className="w-32 h-32 bg-white border-2 border-emerald-300 rounded-lg mx-auto flex items-center justify-center mb-3 shadow-sm">
          <span className="text-4xl">📱</span>
        </div>

        <p className="text-xs text-gray-600 mb-3">Scan to view {displayName}'s profile</p>

        <div className="flex gap-2 justify-center">
          <button
            onClick={handleCopy}
            className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded font-semibold transition active:scale-90"
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: displayName, url: profileUrl })
              }
              onShare?.()
            }}
            className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded font-semibold transition active:scale-90"
          >
            Share
          </button>
        </div>
      </div>
    </div>
  )
}

// ===== PROFILE VISIBILITY STATUS =====

export function ProfileVisibilityStatus({ 
  isPublic = true,
  viewCount = 0 
}: { 
  isPublic?: boolean
  viewCount?: number
}) {
  return (
    <div className="px-4 py-4 border-t border-gray-200">
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{isPublic ? "🌍" : "🔒"}</span>
          <div className="text-left">
            <p className="font-semibold text-gray-900">Profile Visibility</p>
            <p className="text-sm text-gray-600">
              {isPublic ? "Public - visible to everyone" : "Private - only visible to followers"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-emerald-600">{viewCount}</p>
          <p className="text-xs text-gray-600">total views</p>
        </div>
      </div>
    </div>
  )
}
