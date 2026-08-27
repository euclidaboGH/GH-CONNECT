/** @deprecated Prefer MessageScreen from screens-complete / messages-screen — kept for compatibility. */
"use client"

import { useState, useMemo, useCallback } from "react"
import { useGHC } from "@/contexts/ghc-context"
import { Plus, Sparkles, Users, Flame } from "lucide-react"
import { GroupCard } from "./group-card"
import { FeaturedGroupCard } from "./featured-group-card"
import { CreateGroupModal } from "./create-group-modal"
import type { CreateGroupFormData } from "./create-group-modal"

// Enhanced Group type
interface Group {
  id: string
  name: string
  description: string
  icon: string
  category: "trending" | "nearby" | "communities" | "business" | "education" | "sports" | "tech" | "music" | "art" | "gaming" | "general" | "other" | "custom"
  members: number
  onlineMembers?: number
  isJoined: boolean
  isFeatured?: boolean
  image?: string
  coverImage?: string
  createdAt: number
  privacy?: "public" | "private" | "invite-only"
}

// Mock featured groups data - lazily initialized for faster startup
const createFeaturedGroups = (): Group[] => [
  { id: "fg1", name: "Tech Enthusiasts Hub", description: "AI, web dev, startups & innovation", icon: "💻", category: "tech", members: 5234, onlineMembers: 342, isJoined: false, isFeatured: true, createdAt: Date.now() - 7776000000, privacy: "public" },
  { id: "fg2", name: "Fitness & Wellness", description: "Workouts, nutrition & health coaching", icon: "💪", category: "communities", members: 3821, onlineMembers: 187, isJoined: false, isFeatured: true, createdAt: Date.now() - 2592000000, privacy: "public" },
  { id: "fg3", name: "Professional Network", description: "Business, career growth & mentorship", icon: "🤝", category: "business", members: 8921, onlineMembers: 512, isJoined: false, isFeatured: true, createdAt: Date.now() - 1209600000, privacy: "public" },
]

const createSuggestedGroups = (): Group[] => [
  { id: "sg1", name: "Photography Masters", description: "Share work, get feedback & tips", icon: "📸", category: "art", members: 2145, onlineMembers: 89, isJoined: false, createdAt: Date.now() - 5184000000, privacy: "public" },
  { id: "sg2", name: "Adventure Travel", description: "Budget trips, stories & recommendations", icon: "✈️", category: "communities", members: 4532, onlineMembers: 234, isJoined: false, createdAt: Date.now() - 3888000000, privacy: "public" },
  { id: "sg3", name: "Food & Cooking", description: "Recipes, restaurant reviews & foodie chat", icon: "🍕", category: "communities", members: 3214, onlineMembers: 145, isJoined: false, createdAt: Date.now() - 1814400000, privacy: "public" },
]

// Use lazy refs to avoid recreating arrays on every render
const featuredGroupsRef = { current: null as Group[] | null }
const suggestedGroupsRef = { current: null as Group[] | null }

const getFeaturedGroups = () => {
  if (!featuredGroupsRef.current) featuredGroupsRef.current = createFeaturedGroups()
  return featuredGroupsRef.current
}

const getSuggestedGroups = () => {
  if (!suggestedGroupsRef.current) suggestedGroupsRef.current = createSuggestedGroups()
  return suggestedGroupsRef.current
}

export function ChatScreen() {
  const { addToast, createGroup } = useGHC()
  const [searchQuery, setSearchQuery] = useState("")
  const [myGroups, setMyGroups] = useState<Group[]>([])
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [createGroupError, setCreateGroupError] = useState<string | null>(null)

  // Filter all groups by search - single pass with early exit
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return []
    
    const lowerQuery = searchQuery.toLowerCase()
    const featured = getFeaturedGroups()
    const suggested = getSuggestedGroups()
    
    // Single-pass filter avoiding array spread
    const results: Group[] = []
    const checkGroup = (g: Group) => {
      if (g.name.toLowerCase().includes(lowerQuery) || g.description.toLowerCase().includes(lowerQuery)) {
        results.push(g)
      }
    }
    
    featured.forEach(checkGroup)
    suggested.forEach(checkGroup)
    myGroups.forEach(checkGroup)
    
    return results
  }, [searchQuery, myGroups])

  // Organize groups by type - single pass with memoization
  const organizedGroups = useMemo(() => {
    const myGroupIds = new Set(myGroups.map(g => g.id))
    const featured = getFeaturedGroups()
    const suggested = getSuggestedGroups()
    
    return {
      featured: featured.filter(g => !myGroupIds.has(g.id)).slice(0, 3),
      myGroupsList: myGroups.slice(0, 10),
      suggested: suggested.filter(g => !myGroupIds.has(g.id)).slice(0, 6),
    }
  }, [myGroups])

  // Join group handler
  const handleJoinGroup = useCallback((group: Group) => {
    setMyGroups(prev => [...prev, { ...group, isJoined: true }])
    addToast(`Joined ${group.name}!`, "success")
  }, [addToast])

  // Reusable GroupCard renderer to eliminate duplication
  const renderGroupCard = useCallback((group: Group, isJoined: boolean = false, onClickOverride?: () => void) => (
    <GroupCard
      key={group.id}
      id={group.id}
      groupName={group.name}
      lastSenderName="Group"
      lastMessage={group.description}
      lastMessageTime={group.createdAt}
      memberCount={group.members}
      onlineCount={group.onlineMembers || 0}
      category={group.category || "general"}
      isJoined={isJoined}
      onJoin={isJoined ? undefined : () => handleJoinGroup(group)}
      onClick={onClickOverride || (isJoined ? () => addToast(`Opened ${group.name}`, "info") : () => handleJoinGroup(group))}
    />
  ), [handleJoinGroup, addToast])

  // Create group handler
  const handleCreateGroup = useCallback(async (formData: CreateGroupFormData) => {
    try {
      setIsCreatingGroup(true)
      setCreateGroupError(null)

      const nameTrimed = formData.name.trim()
      const descTrimed = formData.description.trim()
      
      if (!nameTrimed || !descTrimed) {
        throw new Error("Name and description are required")
      }
      
      if (nameTrimed.length < 3) {
        throw new Error("Group name must be at least 3 characters")
      }
      
      if (descTrimed.length < 10) {
        throw new Error("Description must be at least 10 characters")
      }

      const newGroup: Group = {
        id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: formData.name,
        description: formData.description,
        icon: "👥",
        category: (formData.category && formData.category.length > 0 ? formData.category.toLowerCase().replace(" ", "_") : "general") as any,
        members: formData.invitedMembers.length + 1,
        onlineMembers: 1,
        isJoined: true,
        isFeatured: false,
        coverImage: formData.coverImage,
        createdAt: Date.now(),
        privacy: formData.privacy,
      }

      setMyGroups((prev) => [newGroup, ...prev])
      await createGroup(formData)

      const memberText = formData.invitedMembers.length > 0 ? `${formData.invitedMembers.length} members invited` : "no members invited yet"
      const privacyText = formData.privacy === "public" ? "Public" : formData.privacy === "private" ? "Private" : "Invite Only"
      addToast(`"${formData.name}" (${privacyText}) created! ${memberText}`, "success")

      setShowCreateGroup(false)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to create group"
      setCreateGroupError(errorMsg)
      addToast(errorMsg, "error")
    } finally {
      setIsCreatingGroup(false)
    }
  }, [createGroup, addToast])

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Header - optimized sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 pt-4 pb-3 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-gray-900">Messages</h1>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="p-2 hover:bg-pink-50 rounded-lg transition active:bg-pink-100"
            aria-label="Create new group chat"
          >
            <Plus size={20} className="text-pink-500" />
          </button>
        </div>

        {/* Single optimized search bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search groups & members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 placeholder:text-gray-500"
            aria-label="Search groups"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Content - optimized scrolling and spacing */}
      <div className="flex-1 overflow-y-auto">
        {/* Search results view */}
        {searchQuery && (
          <div className="px-4 py-4">
            {filteredGroups.length > 0 ? (
              <>
                <p className="text-xs font-medium text-gray-500 mb-3">
                  Found {filteredGroups.length} {filteredGroups.length === 1 ? "group" : "groups"}
                </p>
                <div className="space-y-2">
                  {filteredGroups.map((group) => renderGroupCard(group, false))}
                </div>
              </>
            ) : (
              <div className="py-12 text-center">
                <p className="text-gray-500 text-sm">No groups found for "{searchQuery}"</p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-3 text-pink-500 hover:text-pink-600 text-sm font-medium"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        )}

        {/* Main organized view - no search active */}
        {!searchQuery && (
          <div className="divide-y divide-gray-100">
            {/* Featured Groups Section. Existing groups remain unchanged; starter content is only fallback content when no user groups exist. */}
            {organizedGroups.featured.length > 0 && (
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={17} className="text-amber-500 flex-shrink-0" />
                  <h2 className="text-sm font-bold text-gray-900">{myGroups.length === 0 ? "Start with a group" : "Featured Groups"}</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {organizedGroups.featured.map((group) => (
                    <FeaturedGroupCard
                      key={group.id}
                      id={group.id}
                      name={group.name}
                      description={group.description}
                      icon={group.icon}
                      category={group.category}
                      members={group.members}
                      onlineMembers={group.onlineMembers}
                      coverImage={group.coverImage}
                      isJoined={group.isJoined}
                      onJoin={() => handleJoinGroup(group)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* My Groups Section */}
            {organizedGroups.myGroupsList.length > 0 && (
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-3">
                  <Users size={17} className="text-blue-500 flex-shrink-0" />
                  <h2 className="text-sm font-bold text-gray-900">My Groups</h2>
                  <span className="text-xs text-gray-500 ml-auto">({organizedGroups.myGroupsList.length})</span>
                </div>
                <div className="space-y-1">
                  {organizedGroups.myGroupsList.map((group) => renderGroupCard(group, true))}
                </div>
              </div>
            )}

            {/* Suggested Groups Section */}
            {organizedGroups.suggested.length > 0 && (
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-3">
                  <Flame size={17} className="text-red-500 flex-shrink-0" />
                  <h2 className="text-sm font-bold text-gray-900">Trending Now</h2>
                </div>
                <div className="space-y-1">
                  {organizedGroups.suggested.map((group) => renderGroupCard(group, false))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!organizedGroups.featured.length && !organizedGroups.myGroupsList.length && !organizedGroups.suggested.length && (
              <div className="px-4 py-12 text-center">
                <p className="text-gray-500 text-sm">No groups yet. Create one or discover new groups!</p>
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="mt-4 px-4 py-2 bg-pink-500 text-white rounded-lg text-sm font-medium hover:bg-pink-600"
                >
                  Create a Group
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => {
            setShowCreateGroup(false)
            setCreateGroupError(null)
          }}
          onSubmit={handleCreateGroup}
          isLoading={isCreatingGroup}
          error={createGroupError}
        />
      )}
    </div>
  )
}
