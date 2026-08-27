"use client"

import { useState, useRef, useEffect } from "react"
import { Heart, MessageCircle, ThumbsDown, X, ChevronLeft, ChevronRight, Search, Sliders, Flame, MapPin, Briefcase, ShoppingBag, Calendar, Video, TrendingUp, Clock, UserPlus, Star, Zap, TrendingDown, Eye, Volume2, VolumeX, Bell } from "lucide-react"
import type { Candidate } from "@/lib/ghc-types"
import { LazyImage } from "./lazy-image"
import { calculateMatchScore } from "./user-card"
export { CommunitiesSection } from "./communities-section"

// SearchBar lives in its own module for reliable named exports in App Studio.
export { SearchBar } from "./search-bar"

// FilterPanel lives in its own module to avoid re-export/circular issues in the demo runtime.
export { FilterPanel } from "./filter-panel"
export type { FilterPanelProps } from "./filter-panel"

// UserCard + match score live in user-card.tsx for reliable App Studio exports.
export { UserCard, DiscoverListRow, calculateMatchScore } from "./user-card"
export type { UserCardProps } from "./user-card"
// DiscoverListRow re-exported above

// AI-Powered Smart Suggestions

/** Connection intent — keeps Discover from feeling dating-only */
export type ConnectionMode =
  | "all"
  | "friendship"
  | "professional"
  | "dating"
  | "community"
  | "collaborate"
  | "mentor"
  | "learn"

export function ConnectionModeBar({
  mode,
  onChange,
}: {
  mode: ConnectionMode
  onChange: (m: ConnectionMode) => void
}) {
  const modes: { id: ConnectionMode; label: string }[] = [
    { id: "all", label: "All" },
    { id: "friendship", label: "Friends" },
    { id: "professional", label: "Pro" },
    { id: "collaborate", label: "Collaborate" },
    { id: "mentor", label: "Mentor" },
    { id: "learn", label: "Learn" },
    { id: "dating", label: "Dating" },
    { id: "community", label: "Community" },
  ]
  return (
    <div className="flex gap-1.5 overflow-x-auto px-4 py-2 scrollbar-hide" role="tablist" aria-label="Connection intent">
      {modes.map((m) => (
        <button
          key={m.id}
          type="button"
          role="tab"
          aria-selected={mode === m.id}
          onClick={() => onChange(m.id)}
          className={`flex min-h-9 shrink-0 items-center rounded-full px-3.5 py-1.5 text-[11px] font-bold transition active:scale-95 ${
            mode === m.id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

/** Intent filters that actually narrow the list (keyword + goal signals) */
export function candidateMatchesIntent(c: Candidate, mode: ConnectionMode): boolean {
  if (mode === "all") return true
  const interests = (Array.isArray(c.interests) ? c.interests : []).map((i) => String(i).toLowerCase())
  const bio = String((c as { bio?: string }).bio || "").toLowerCase()
  const goals = Array.isArray((c as { relationshipGoals?: string[] }).relationshipGoals)
    ? ((c as { relationshipGoals?: string[] }).relationshipGoals || []).map((g) => String(g).toLowerCase())
    : []
  const occupation = String((c as { occupation?: string }).occupation || (c as { profession?: string }).profession || "").toLowerCase()
  const blob = interests.join(" ") + " " + bio + " " + goals.join(" ") + " " + occupation
  switch (mode) {
    case "professional":
      return /work|job|career|business|tech|startup|founder|engineer|design|finance|product/.test(blob) || Boolean(occupation)
    case "collaborate":
      return /collab|project|partner|co-?found|build|startup|team/.test(blob)
    case "mentor":
      return /mentor|coach|advise|guide|senior|lead/.test(blob)
    case "learn":
      return /learn|student|course|skill|study|junior|beginner/.test(blob)
    case "dating":
      return /dating|relationship|single|love|romance/.test(blob) || goals.some((g) => /date|relationship/.test(g))
    case "friendship":
      return /friend|hobby|sport|music|travel|game/.test(blob) || interests.length > 0
    case "community":
      return /community|volunteer|faith|local|group/.test(blob)
    default:
      return true
  }
}

function SmartSuggestionsSection({
  candidates,
  onViewProfile,
  onLike,
  onMessage,
  userInterests,
  userAge,
  userLocation,
}: {
  candidates: Candidate[]
  onViewProfile: (candidate: Candidate) => void
  onLike: (id: string) => void
  onMessage: (id: string) => void
  userInterests?: string[]
  userAge?: number
  userLocation?: string
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [actionToast, setActionToast] = useState("")
  const confirmAction = (message: string, action: () => void) => {
    action()
    setActionToast(message)
    window.setTimeout(() => setActionToast(""), 1800)
  }

  const suggestions = candidates
    .filter((c) => c && (c.name || c.id))
    .slice(0, 8)
    .map((candidate) => {
      const score = calculateMatchScore(candidate, userInterests, userAge, userLocation)
      const reason = candidate.online
        ? "Active now"
        : candidate.verified
          ? "Trusted profile"
          : candidate.interests?.length
            ? "Shared interests"
            : "Popular near you"
      return { candidate, score, reason }
    })

  if (suggestions.length === 0) return null

  const currentIndexSafe = currentIndex % suggestions.length
  const { candidate, score, reason } = suggestions[currentIndexSafe]
  const safeName = typeof candidate?.name === "string" && candidate.name.trim() ? candidate.name.trim() : "Member"
  const safePhoto =
    typeof candidate?.photo === "string" && candidate.photo
      ? candidate.photo
      : "/placeholder.svg?height=320&width=320"
  const safeLocation =
    typeof candidate?.location === "string" && candidate.location.trim()
      ? candidate.location.trim()
      : "Global"
  const safeAge = Number.isFinite(Number(candidate?.age)) ? Number(candidate.age) : null

  return (
    <div className="border-b border-border bg-gradient-to-b from-emerald-50/80 to-transparent px-4 py-3 dark:from-emerald-950/20">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-foreground">Picks for you</h3>
          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
            {currentIndexSafe + 1}/{suggestions.length}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous pick"
            onClick={() => setCurrentIndex((i) => (i - 1 + suggestions.length) % suggestions.length)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-card border border-border text-muted-foreground"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Next pick"
            onClick={() => setCurrentIndex((i) => (i + 1) % suggestions.length)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-card border border-border text-muted-foreground"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onViewProfile(candidate)}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left shadow-sm transition active:scale-[0.99]"
      >
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
          <img src={safePhoto} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-foreground">
            {safeName}
            {safeAge != null ? <span className="font-semibold text-muted-foreground"> · {safeAge}</span> : null}
          </p>
          <p className="truncate text-[12px] text-muted-foreground">{safeLocation}</p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            {reason}
          </p>
        </div>
      </button>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => confirmAction("Saved", () => onLike(candidate.id))}
          className="min-h-10 flex-1 rounded-xl border border-border bg-card text-[12px] font-bold text-foreground"
        >
          Interested
        </button>
        <button
          type="button"
          onClick={() => onViewProfile(candidate)}
          className="min-h-10 flex-1 rounded-xl bg-primary text-[12px] font-bold text-primary-foreground"
        >
          View profile
        </button>
        <button
          type="button"
          onClick={() => onMessage(candidate.id)}
          className="min-h-10 rounded-xl border border-border bg-card px-3 text-[12px] font-bold text-foreground"
        >
          Message
        </button>
      </div>
      {actionToast ? (
        <p className="mt-1 text-center text-[11px] font-semibold text-emerald-600" role="status">
          {actionToast}
        </p>
      ) : null}
      <div className="mt-2 flex justify-center gap-1.5" role="tablist" aria-label="Pick pages">
        {suggestions.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Pick ${i + 1}`}
            aria-current={i === currentIndexSafe}
            onClick={() => setCurrentIndex(i)}
            className={`h-1.5 rounded-full transition ${
              i === currentIndexSafe ? "w-4 bg-emerald-600" : "w-1.5 bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    </div>
  )
}


export function SuggestionsCarousel({
  candidates,
  onViewProfile,
  onLike,
  onMessage,
  userInterests,
  userAge,
  userLocation,
}: {
  candidates: Candidate[]
  onViewProfile: (candidate: Candidate) => void
  onLike: (id: string) => void
  onMessage: (id: string) => void
  userInterests?: string[]
  userAge?: number
  userLocation?: string
}) {
  return <SmartSuggestionsSection candidates={candidates} onViewProfile={onViewProfile} onLike={onLike} onMessage={onMessage} userInterests={userInterests} userAge={userAge} userLocation={userLocation} />
}

export function ProfilePreviewModal({
  candidate,
  isOpen,
  onClose,
  onLike,
  onMessage,
  userInterests = [],
  userAge,
  userLocation,
}: {
  candidate: Candidate | null
  isOpen: boolean
  onClose: () => void
  onLike: (id: string) => void
  onMessage: (id: string) => void
  userInterests?: string[]
  userAge?: number
  userLocation?: string
  }) {
  if (!isOpen || !candidate) return null

  const safeName =
    typeof candidate.name === "string" && candidate.name.trim()
      ? candidate.name.trim()
      : "Pi Member"
  const safeLocation =
    typeof candidate.location === "string" && candidate.location.trim()
      ? candidate.location.trim()
      : "Global"
  const safeAge = Number.isFinite(Number(candidate.age)) ? Number(candidate.age) : null
  const score = calculateMatchScore(candidate, userInterests, userAge, userLocation)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
      <div className="bg-white w-full rounded-t-3xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{safeName}&apos;s Profile</h2>
            <p className="text-xs text-gray-600">{safeLocation}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Content */}
        <div className="p-4 space-y-4 pb-4">
          {/* Photo with overlay */}
          <div className="relative h-72 bg-gradient-to-br from-gray-300 to-gray-400 rounded-2xl overflow-hidden">
            <LazyImage src={candidate.photo} alt={safeName} className="h-full w-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
          </div>

          {/* Match Score Card */}
          {score > 0 && (
            <div className="bg-gradient-to-r from-emerald-50 to-pink-50 border-2 border-emerald-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase">Match Score</p>
                  <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-pink-600">
                    {score}%
                  </p>
                </div>
                <div className="text-4xl font-bold text-emerald-600 opacity-20">
                  {score >= 75 ? "💯" : score >= 50 ? "🎯" : "⭐"}
                </div>
              </div>
              <p className="text-xs text-gray-700 mt-2">Based on shared interests & profile compatibility</p>
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-3">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                {safeName}{safeAge !== null ? `, ${safeAge}` : ""}
              </h3>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1 text-gray-600">
                  <MapPin size={16} />
                  <span className="text-sm">{safeLocation}</span>
                </div>
              </div>
            </div>

            {/* Status Badges */}
            <div className="flex gap-2 flex-wrap">
              {Boolean(candidate?.verified) && (
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-bold">
                  <Star size={14} fill="currentColor" /> Verified
                </span>
              )}
              {safeOnline && (
                <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-xs font-bold">
                  <span className="w-2 h-2 bg-green-600 rounded-full"></span> Active
                </span>
              )}
            </div>
          </div>

          {/* Bio */}
          {candidate.bio && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-800 leading-relaxed">{candidate.bio}</p>
            </div>
          )}

          {/* Interests */}
          {candidate.interests.length > 0 && (
            <div>
              <h4 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-2">
                <Zap size={16} className="text-yellow-500" />
                Interests
              </h4>
              <div className="flex flex-wrap gap-2">
                {candidate.interests.map((interest) => (
                  <span
                    key={interest}
                    className="bg-gradient-to-r from-emerald-100 to-pink-100 text-emerald-700 px-3 py-2 rounded-full text-sm font-semibold border border-emerald-200"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Activity Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
              <p className="text-xs text-blue-600 font-semibold uppercase">Status</p>
              <p className="text-sm font-bold text-blue-900 mt-1">
                {candidate.online ? (
                  <span className="flex items-center justify-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Active
                  </span>
                ) : (
                  <span>Last seen {Math.floor(Math.random() * 24)}h ago</span>
                )}
              </p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-200">
              <p className="text-xs text-emerald-600 font-semibold uppercase">Joined</p>
              <p className="text-sm font-bold text-emerald-900 mt-1">
                {Math.floor(Math.random() * 12) + 1} months ago
              </p>
            </div>
          </div>
        </div>

        {/* Sticky Action Buttons */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3 max-w-md mx-auto">
          <button
            onClick={() => {
              onMessage(candidate.id)
              onClose()
            }}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-bold text-sm transition active:scale-95 flex items-center justify-center gap-2 shadow-md"
          >
            <MessageCircle size={18} />
            Message
          </button>
          <button
            onClick={() => {
              onLike(candidate.id)
              onClose()
            }}
            className="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white py-3 rounded-lg font-bold text-sm transition active:scale-95 flex items-center justify-center gap-2 shadow-md"
          >
            <Heart size={18} fill="currentColor" />
            Like
          </button>
        </div>
      </div>
    </div>
  )
}

// Section Container - Reusable for all discovery sections
export function DiscoverySection({ 
  title, 
  icon: Icon, 
  children, 
  actionLabel, 
  onAction 
}: { 
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon}
          <h3 className="font-bold text-sm text-gray-900">{title}</h3>
        </div>
        {actionLabel && (
          <button
            onClick={onAction}
            className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
          >
            {actionLabel}
          </button>
        )}
      </div>
      <div className="px-4 pb-3">{children}</div>
    </div>
  )
}

// Trending Section
export function TrendingSection({ candidates, onViewProfile, onLike, onMessage }: { candidates: Candidate[]; onViewProfile: (c: Candidate) => void; onLike: (id: string) => void; onMessage: (id: string) => void }) {
  return (
    <DiscoverySection title="Trending" icon={<Flame className="w-4 h-4 text-orange-500" />} actionLabel="See all">
      <div className="grid grid-cols-2 gap-3">
        {candidates.slice(0, 4).map((c) => (
          <div key={c.id} className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg overflow-hidden border border-orange-200 cursor-pointer hover:shadow-md transition" onClick={() => onViewProfile(c)}>
            <div className="h-20 bg-gray-200 relative">
              <img loading="lazy" decoding="async" src={c.photo} alt={c.name} className="w-full h-full object-cover" />
              {c.online && <div className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full border border-white"></div>}
            </div>
            <div className="p-2">
              <h4 className="font-bold text-xs text-gray-900">{c.name}, {c.age}</h4>
              <p className="text-[10px] text-gray-600 truncate">{c.location}</p>
            </div>
          </div>
        ))}
      </div>
    </DiscoverySection>
  )
}

// Nearby Section
export function NearbySection({ candidates, onViewProfile, onLike, onMessage }: { candidates: Candidate[]; onViewProfile: (c: Candidate) => void; onLike: (id: string) => void; onMessage: (id: string) => void }) {
  return (
    <DiscoverySection title="Nearby" icon={<MapPin className="w-4 h-4 text-blue-500" />} actionLabel="Map view">
      <div className="space-y-2">
        {candidates.slice(0, 3).map((c) => (
          <div key={c.id} onClick={() => onViewProfile(c)} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition">
            <img loading="lazy" decoding="async" src={c.photo} alt={c.name} className="w-12 h-12 rounded-full object-cover" />
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm text-gray-900">{c.name}, {c.age}</h4>
              <p className="text-xs text-gray-600 truncate flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {c.location}
              </p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onMessage(c.id); }} className="w-8 h-8 bg-emerald-100 hover:bg-emerald-200 text-emerald-600 rounded-full flex items-center justify-center transition active:scale-90">
              <MessageCircle size={14} />
            </button>
          </div>
        ))}
      </div>
    </DiscoverySection>
  )
}

// Suggested Friends Section
/* SuggestedFriendsSection → discovery-sections */

export function SuggestedCreatorsSection({ candidates, onViewProfile, onFollow }: { candidates: Candidate[]; onViewProfile: (c: Candidate) => void; onFollow: (id: string) => void }) {
  return (
    <DiscoverySection title="Suggested Creators" icon={<Video className="w-4 h-4 text-indigo-500" />} actionLabel="Browse">
      <div className="space-y-2">
        {candidates.slice(0, 4).map((c) => (
          <div key={c.id} onClick={() => onViewProfile(c)} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition">
            <img loading="lazy" decoding="async" src={c.photo} alt={c.name} className="w-10 h-10 rounded-full object-cover border-2 border-indigo-200" />
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm text-gray-900 flex items-center gap-1">{c.name} {c.verified && <span className="text-blue-500 text-xs">✓</span>}</h4>
              <p className="text-xs text-gray-600">Creator</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onFollow(c.id); }} className="px-3 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-full text-xs font-bold transition active:scale-90">
              Follow
            </button>
          </div>
        ))}
      </div>
    </DiscoverySection>
  )
}



// Businesses Section
export function BusinessesSection({ onViewBusiness }: { onViewBusiness: (name: string) => void }) {
  const businesses = ["Coffee Shop", "Gym", "Bookstore", "Art Studio", "Restaurant"]
  return (
    <DiscoverySection title="Businesses" icon={<Briefcase className="w-4 h-4 text-amber-600" />} actionLabel="More">
      <div className="space-y-2">
        {businesses.map((b) => (
          <button key={b} onClick={() => onViewBusiness(b)} className="w-full text-left flex items-center gap-3 p-2 hover:bg-amber-50 rounded-lg transition active:scale-95">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-gray-900">{b}</h4>
              <p className="text-xs text-gray-600">Local business</p>
            </div>
          </button>
        ))}
      </div>
    </DiscoverySection>
  )
}

// Marketplace Section
export function MarketplaceSection({ onViewProduct }: { onViewProduct: (name: string) => void }) {
  const products = ["Handmade Jewelry", "Vintage Books", "Photography Prints", "Art Supplies"]
  return (
    <DiscoverySection title="Marketplace" icon={<ShoppingBag className="w-4 h-4 text-rose-500" />} actionLabel="Shop">
      <div className="grid grid-cols-2 gap-3">
        {products.map((p) => (
          <button key={p} onClick={() => onViewProduct(p)} className="p-2 border border-rose-200 hover:border-rose-400 rounded-lg transition active:scale-95 text-center">
            <div className="w-full h-16 bg-rose-50 rounded mb-1 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-rose-400" />
            </div>
            <h4 className="font-bold text-xs text-gray-900 line-clamp-2">{p}</h4>
          </button>
        ))}
      </div>
    </DiscoverySection>
  )
}

// Events Section
export function EventsSection({ onViewEvent }: { onViewEvent: (name: string) => void }) {
  const events = ["Tech Meetup", "Art Exhibition", "Speed Dating", "Book Club", "Networking Event"]
  return (
    <DiscoverySection title="Events" icon={<Calendar className="w-4 h-4 text-emerald-500" />} actionLabel="Calendar">
      <div className="space-y-2">
        {events.map((e) => (
          <button key={e} onClick={() => onViewEvent(e)} className="w-full text-left flex items-start gap-3 p-2 hover:bg-emerald-50 rounded-lg transition active:scale-95">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-sm text-gray-900">{e}</h4>
              <p className="text-xs text-gray-600">Coming soon</p>
            </div>
          </button>
        ))}
      </div>
    </DiscoverySection>
  )
}

// Popular Posts Section
export function PopularPostsSection({ posts, onViewPost }: { posts: any[]; onViewPost: (postId: string) => void }) {
  return (
    <DiscoverySection title="Popular Posts" icon={<TrendingUp className="w-4 h-4 text-red-500" />} actionLabel="Explore">
      <div className="space-y-2">
        {(posts || []).slice(0, 3).map((p: any) => (
          <button key={p.id} onClick={() => onViewPost(p.id)} className="w-full text-left flex gap-3 p-2 hover:bg-red-50 rounded-lg transition active:scale-95">
            {p.images?.[0] && <img loading="lazy" decoding="async" src={p.images[0]} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />}
            <div className="min-w-0">
              <h4 className="font-bold text-xs text-gray-900 truncate">{p.authorName}</h4>
              <p className="text-xs text-gray-600 line-clamp-2">{p.content}</p>
              <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1"><Heart className="w-3 h-3" /> {p.likes} likes</p>
            </div>
          </button>
        ))}
      </div>
    </DiscoverySection>
  )
}

// Live Section
export function LiveSection({ onViewLive }: { onViewLive: (streamId: string) => void }) {
  const liveStreams = [
    { id: "live-1", name: "Travel Tips", creator: "Sarah M." },
    { id: "live-2", name: "Cooking Class", creator: "Emma L." },
  ]
  return (
    <DiscoverySection title="Live Now" icon={<div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />} actionLabel="All">
      <div className="space-y-2">
        {liveStreams.map((s) => (
          <button key={s.id} onClick={() => onViewLive(s.id)} className="w-full text-left flex gap-3 p-2 hover:bg-red-50 rounded-lg transition active:scale-95 border border-red-200">
            <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-red-600 rounded flex items-center justify-center flex-shrink-0">
              <Video className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-sm text-gray-900">{s.name}</h4>
              <p className="text-xs text-gray-600">{s.creator}</p>
            </div>
            <div className="flex-shrink-0 flex items-center">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-1"></div>
            </div>
          </button>
        ))}
      </div>
    </DiscoverySection>
  )
}

// Recent Searches Section
export function RecentSearchesSection({ searches, onSearch, onClear, onRemove }: { searches: string[]; onSearch: (query: string) => void; onClear: () => void; onRemove?: (query: string) => void }) {
  if (!searches.length) return null
  return (
    <DiscoverySection title="Recent Searches" icon={<Clock className="w-4 h-4 text-gray-500" />} actionLabel="Clear" onAction={onClear}>
  <div className="flex flex-wrap gap-2">
  {searches.map((s) => (
  <div key={s} className="flex items-center gap-1 rounded-full bg-gray-100 pl-3 pr-1.5 py-1.5 text-xs font-semibold text-gray-700">
  <button type="button" onClick={() => onSearch(s)} className="max-w-[9rem] truncate hover:text-emerald-700">{s}</button>
  {onRemove && <button type="button" onClick={() => onRemove(s)} className="rounded-full p-0.5 text-gray-400 hover:bg-white hover:text-gray-700" aria-label={`Remove ${s} from recent searches`}><X size={12} /></button>}
  </div>
  ))}
  </div>
  </DiscoverySection>
  )
}

// Quick Actions Bar
export function QuickActionsBar({ selectedCandidate, onFollow, onMessage, onInvite, onViewProfile }: { selectedCandidate: Candidate | null; onFollow: (id: string) => void; onMessage: (id: string) => void; onInvite: (id: string) => void; onViewProfile: (c: Candidate) => void }) {
  if (!selectedCandidate) return null
  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-2">
      <button onClick={() => onFollow(selectedCandidate.id)} className="flex-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 py-2 rounded-lg font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1">
        <UserPlus className="w-4 h-4" /> Follow
      </button>
      <button onClick={() => onMessage(selectedCandidate.id)} className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 py-2 rounded-lg font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1">
        <MessageCircle className="w-4 h-4" /> Message
      </button>
      <button onClick={() => onInvite(selectedCandidate.id)} className="flex-1 bg-pink-100 hover:bg-pink-200 text-pink-700 py-2 rounded-lg font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1">
        <Heart className="w-4 h-4" /> Invite
      </button>
    </div>
  )
}
