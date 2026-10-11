"use client"

/**
 * Discover — connection-intent discovery (not dating-only).
 * Wired to DiscoveryCandidate contract + explainable reasons (Prompt #37).
 * Never manufactures candidates; production filters studio seeds.
 */

import { useMemo, useState, useCallback, useEffect, startTransition } from "react"
import { useGHCDiscovery } from "@/contexts/ghc-context"
import { ConnectionModeBar } from "./discovery-components"
import { UserCard } from "./user-card"
import { EmptyState } from "./empty-state"
import { Search, SlidersHorizontal, X } from "lucide-react"
import {
  resolveUserIntents,
  saveConnectionIntents,
  type ConnectionIntentId,
} from "@/lib/connection-intents"
import { IdentityService } from "@/lib/identity/identity-service"
import {
  formatReasonsForUi,
  type RawDiscoveryCandidate,
} from "@/lib/domains/adapters/discovery-adapter"
import { searchDiscoveryObjects } from "@/lib/domains/adapters/multi-object-discovery"
import type { DiscoveryCategory, DiscoveryCandidate } from "@/lib/domains/contracts/discovery"
import { discoveryEmptyState, isPersonCandidate } from "@/lib/domains/contracts/discovery"
import {
  normalizeConnectionState,
  type ConnectionUiState,
} from "@/lib/domains/adapters/connection-graph-adapter"
import { DiscoveryObjectCard } from "./discovery-object-card"
import { persistOutgoingRequestIntent } from "@/lib/domains/adapters/connection-request-intent"
import {
  sendUnifiedConnectionRequest,
  acceptUnifiedConnectionRequest,
  declineUnifiedConnectionRequest,
} from "@/lib/domains/adapters/unified-connection-request"
import { ConnectionIntentPicker } from "./connection-intent-picker"
import {
  submitConnectionFromPicker,
  userFacingConnectError,
} from "@/lib/domains/adapters/connection-connect-flow"

const DISCOVERY_CATEGORIES: { id: DiscoveryCategory; label: string }[] = [
  { id: "people", label: "People" },
  { id: "friends", label: "Friends" },
  { id: "professionals", label: "Professionals" },
  { id: "collaborators", label: "Collaborators" },
  { id: "mentors", label: "Mentors" },
  { id: "communities", label: "Communities" },
  { id: "events", label: "Events" },
  { id: "activities", label: "Activities" },
  { id: "services", label: "Services" },
]

export function DiscoveryGridScreen() {
  const ghc = useGHCDiscovery() as {
    candidates?: any[]
    profile?: {
      interests?: string[]
      primaryMode?: string
      connectionIntents?: string[]
      city?: string
      country?: string
      age?: number
      friends?: string[]
      following?: string[]
    }
    friends?: string[]
    following?: string[]
    outgoingFriendRequestIds?: string[]
    incomingFriendRequestIds?: string[]
    matchIds?: string[]
    blockedUsers?: string[]
    swipe?: (id: string, dir: string) => Promise<void>
    blockUser?: (id: string) => void
    addToast?: (m: string, t?: string) => void
    reportContent?: (kind: string, id: string, reason: string) => void
    startConversation?: (userId: string, userName?: string, userPhoto?: string) => Promise<string | null>
    loading?: boolean
    error?: string | null
  }
  const meId = IdentityService.getCurrentUserId()
  const profileIntents = resolveUserIntents(meId, ghc.profile as any)
  const [selectedIntents, setSelectedIntents] = useState<ConnectionIntentId[]>(() => profileIntents)
  const [category, setCategory] = useState<DiscoveryCategory>("people")
  const [useModernCard, setUseModernCard] = useState(true)
  const onIntentsChange = useCallback(
    (ids: ConnectionIntentId[]) => {
      setSelectedIntents(ids)
      try {
        saveConnectionIntents(meId, ids)
      } catch {
        /* */
      }
    },
    [meId],
  )
  const [query, setQuery] = useState("")
  const [pickerTarget, setPickerTarget] = useState<{ id: string; name?: string } | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [connectBusy, setConnectBusy] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isOffline, setIsOffline] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const userInterests = useMemo(
    () => (Array.isArray(ghc.profile?.interests) ? ghc.profile.interests : []),
    [ghc.profile],
  )
  const userLocation = [ghc.profile?.city, ghc.profile?.country].filter(Boolean).join(", ")

  const graphSnap = useMemo(
    () => ({
      currentUserId: meId,
      friends: ghc.friends || ghc.profile?.friends || [],
      following: ghc.following || ghc.profile?.following || [],
      blockedUsers: ghc.blockedUsers || [],
      outgoingFriendRequestIds: ghc.outgoingFriendRequestIds || [],
      incomingFriendRequestIds: ghc.incomingFriendRequestIds || [],
      matchIds: ghc.matchIds || [],
    }),
    [meId, ghc.friends, ghc.following, ghc.blockedUsers, ghc.outgoingFriendRequestIds, ghc.incomingFriendRequestIds, ghc.matchIds, ghc.profile],
  )

  const adapted = useMemo(() => {
    const rawAll = Array.isArray(ghc.candidates) ? (ghc.candidates as RawDiscoveryCandidate[]) : []
    const filterIntents = selectedIntents.length ? selectedIntents : profileIntents
    const result = searchDiscoveryObjects(
      {
        category,
        intents: filterIntents,
        interests: userInterests,
        limit: 36,
      },
      {
        userId: meId,
        interests: userInterests,
        intents: filterIntents,
        city: ghc.profile?.city,
        country: ghc.profile?.country,
      },
      rawAll,
    )
    let list = result.ok ? result.data : []
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter((c) => {
        const blob = `${c.displayName} ${c.subtitle || ""}`.toLowerCase()
        return blob.includes(q)
      })
    }
    return { list, source: result.ok ? result.source : "empty" }
  }, [
    ghc.candidates,
    selectedIntents,
    profileIntents,
    query,
    userInterests,
    category,
    meId,
    ghc.profile?.city,
    ghc.profile?.country,
  ])

  const connectionStateFor = useCallback(
    (id: string): ConnectionUiState => normalizeConnectionState(id, graphSnap),
    [graphSnap],
  )

  /** Interest / like only — never creates a connection request */
  const onLike = useCallback(
    async (id: string) => {
      if (busyId) return
      setBusyId(id)
      try {
        await ghc.swipe?.(id, "like")
        setStatusMsg("Interest sent for matching")
        ghc.addToast?.(
          "Liked for matching — mutual interest is an opportunity, not an automatic connection",
          "success"
        )
        window.setTimeout(() => setStatusMsg(null), 2500)
      } catch {
        ghc.addToast?.("Could not send interest", "error")
      } finally {
        setBusyId(null)
      }
    },
    [busyId, ghc],
  )

  /** Open intent picker — does not send until confirm */
  const onConnect = useCallback(
    (id: string, name?: string) => {
      if (busyId || connectBusy) return
      const st = connectionStateFor(id)
      if (st === "outgoing_pending") {
        ghc.addToast?.("Request already pending", "info")
        return
      }
      if (st === "connected" || st === "mutual") {
        ghc.addToast?.("You're already connected", "info")
        return
      }
      setConnectError(null)
      setPickerTarget({ id, name })
    },
    [busyId, connectBusy, connectionStateFor, ghc],
  )

  const confirmConnect = useCallback(
    async (result: { intents: ConnectionIntentId[]; note?: string }) => {
      if (!pickerTarget) return
      setConnectBusy(true)
      setConnectError(null)
      try {
        const r = await submitConnectionFromPicker(
          meId,
          {
            userId: pickerTarget.id,
            displayName: pickerTarget.name,
            source: "discover",
          },
          result.intents,
          result.note
        )
        if (!r.ok) {
          setConnectError(userFacingConnectError(r.code || r.error))
          return
        }
        setPickerTarget(null)
        ghc.addToast?.(
          "Connection request sent — they can accept when ready",
          "success"
        )
      } catch {
        setConnectError(userFacingConnectError("REQUEST_FAILED"))
      } finally {
        setConnectBusy(false)
      }
    },
    [pickerTarget, meId, ghc],
  )

  const onPass = useCallback(
    async (id: string) => {
      if (busyId) return
      setBusyId(id)
      try {
        await ghc.swipe?.(id, "pass")
        setStatusMsg("Passed — we will show fewer similar profiles")
        ghc.addToast?.("Passed", "info")
        window.setTimeout(() => setStatusMsg(null), 2000)
      } catch {
        ghc.addToast?.("Could not update preference", "error")
      } finally {
        setBusyId(null)
      }
    },
    [busyId, ghc],
  )

  const onCardAction = useCallback(
    (action: string, candidate: DiscoveryCandidate) => {
      const id = candidate.id
      if (action === "view_profile") {
        try {
          window.dispatchEvent(new CustomEvent("ghc:open-profile", { detail: { userId: id } }))
        } catch {
          /* */
        }
        return
      }
      if (action === "message") {
        startTransition(() => {
          try {
            ghc.startConversation?.(id, candidate.displayName, isPersonCandidate(candidate) ? (candidate.avatarUrl || undefined) : undefined)
            window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: "messages" }))
          } catch {
            window.dispatchEvent(
              new CustomEvent("ghc:start-chat", {
                detail: { userId: id, name: candidate.displayName },
              }),
            )
          }
        })
        return
      }
      if (action === "like") {
        void onLike(id)
        return
      }
      if (action === "pass") {
        void onPass(id)
        return
      }
      if (action === "connect") {
        onConnect(id, candidate.displayName)
        return
      }
      if (action === "accept") {
        void acceptUnifiedConnectionRequest(meId, id).then((r) => {
          if (!r.ok) ghc.addToast?.(r.error || "Could not accept", "error")
          else ghc.addToast?.("Connected", "success")
        })
        return
      }
      if (action === "decline") {
        void declineUnifiedConnectionRequest(meId, id).then((r) => {
          if (!r.ok) ghc.addToast?.(r.error || "Could not decline", "error")
        })
        return
      }
    },
    [ghc, onConnect, onLike, onPass, meId],
  )


  useEffect(() => {
    if (typeof window === "undefined") return
    const sync = () => setIsOffline(!navigator.onLine)
    sync()
    window.addEventListener("online", sync)
    window.addEventListener("offline", sync)
    return () => {
      window.removeEventListener("online", sync)
      window.removeEventListener("offline", sync)
    }
  }, [])

  const emptyCopy = discoveryEmptyState(category)
  const loading = Boolean(ghc.loading)
  const error = ghc.error

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground contain-content">
      <header className="gh-page-header-slim border-b border-border/50 bg-card/95 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-bold leading-none tracking-tight text-foreground">Discover</h1>
          </div>
          <div className="flex min-h-9 min-w-0 flex-[1.4] items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 shadow-sm">
            <Search size={14} className="shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people, interests…"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              aria-label="Search people"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="shrink-0 text-muted-foreground"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className="gh-icon-btn h-8 w-8 shrink-0 border border-border/40"
            aria-label={filtersOpen ? "Hide connection filters" : "Show connection filters"}
            aria-expanded={filtersOpen}
            title="Connection intent filters"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <SlidersHorizontal size={13} />
          </button>
        </div>
      </header>
      <div className="px-3 pt-2.5">
        <div className="rounded-[1.25rem] border border-border/50 bg-card px-3.5 py-2.5 shadow-[var(--gh-card-shadow)]">
          <p className="text-[13px] font-bold tracking-tight text-foreground">Find people with intent</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Friendship, work, mentoring, and communities — not dating-only. Like or pass for matching; connect when you are ready. Cards explain why they appear.
          </p>
        </div>
      </div>


      <div className="sr-only" role="status" aria-live="polite">
        {statusMsg || (loading ? "Loading discovery" : "")}
      </div>

      {isOffline ? (
        <div
          className="mx-3 mt-2 rounded-[1.25rem] border border-amber-200/80 bg-amber-50/90 px-3.5 py-2.5 text-[12px] text-amber-950 shadow-sm dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          <p className="font-semibold">You&apos;re offline</p>
          <p className="mt-0.5 text-[11px] leading-snug opacity-90">
            Showing candidates already on this device. New people load when you reconnect.
          </p>
        </div>
      ) : null}

            {filtersOpen ? (
        <ConnectionModeBar
          selectedIntents={selectedIntents}
          onIntentsChange={(ids) => onIntentsChange(ids as ConnectionIntentId[])}
        />
      ) : null}

      <div
        className="flex gap-1.5 overflow-x-auto px-3 pb-2 scrollbar-hide"
        role="tablist"
        aria-label="Discovery categories"
        onKeyDown={(e) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return
          e.preventDefault()
          const idx = DISCOVERY_CATEGORIES.findIndex((c) => c.id === category)
          if (idx < 0) return
          let next = idx
          if (e.key === "ArrowRight") next = (idx + 1) % DISCOVERY_CATEGORIES.length
          if (e.key === "ArrowLeft") next = (idx - 1 + DISCOVERY_CATEGORIES.length) % DISCOVERY_CATEGORIES.length
          if (e.key === "Home") next = 0
          if (e.key === "End") next = DISCOVERY_CATEGORIES.length - 1
          setCategory(DISCOVERY_CATEGORIES[next].id)
        }}
      >
        {DISCOVERY_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={category === cat.id}
            tabIndex={category === cat.id ? 0 : -1}
            onClick={() => setCategory(cat.id)}
            className={
              category === cat.id
                ? "shrink-0 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                : "shrink-0 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            }
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 gh-scroll-root overflow-y-auto px-3 pb-24 pt-1">
        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading discovery">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-[1.25rem] border border-border/40 bg-card shadow-sm">
                <div className="h-36 bg-muted/60" />
                <div className="space-y-2 p-3">
                  <div className="h-3 w-32 rounded bg-muted" />
                  <div className="h-2.5 w-48 rounded bg-muted/70" />
                  <div className="h-9 w-full rounded-2xl bg-muted/50" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <EmptyState
            variant="generic"
            title="Could not load discovery"
            description={String(error)}
            action={{
              label: "Try again",
              onClick: () => {
                try {
                  window.dispatchEvent(new CustomEvent("ghc:refresh-discovery"))
                } catch {
                  /* */
                }
              },
            }}
          />
        ) : (adapted.list.length === 0) ? (
          <EmptyState
            variant="discover"
            title={emptyCopy.title}
            description={
              query
                ? "No members match this search. Try different keywords or intents."
                : emptyCopy.description
            }
            action={{
              label: emptyCopy.primaryAction?.label || "Update connection goals",
              onClick: () => {
                try {
                  window.dispatchEvent(
                    new CustomEvent("ghc:navigate", {
                      detail: { tab: emptyCopy.primaryAction?.tab || "profile" },
                    }),
                  )
                } catch {
                  /* */
                }
              },
            }}
            secondaryAction={{
              label: query.trim() ? "Clear search" : "Clear filters",
              onClick: () => {
                onIntentsChange([])
                setQuery("")
                setCategory("people")
                setFiltersOpen(true)
              },
            }}
          />
        ) : (
          <div
            className="mx-auto flex max-w-[var(--gh-content-max,28rem)] flex-col gap-2.5 pb-2"
            role="list"
            aria-label="Discovery candidates"
          >
            <div className="flex items-center justify-between gap-2 px-0.5">
              <p className="text-[11px] font-medium text-muted-foreground" aria-live="polite">
                {adapted.list.length} {category}
                {query.trim() ? ` matching “${query.trim()}”` : " · explainable matches"}
              </p>
              <button
                type="button"
                className="text-[10px] font-medium text-primary"
                onClick={() => setUseModernCard((v) => !v)}
              >
                {useModernCard ? "Photo cards" : "Connection cards"}
              </button>
            </div>
            {adapted.list.map((candidate) => {
              const id = candidate.id
              const state = connectionStateFor(id)
              if (useModernCard) {
                return (
                  <div key={id} className={busyId === id ? "pointer-events-none opacity-60" : undefined}>
                    <DiscoveryObjectCard
                      candidate={candidate}
                      connectionState={isPersonCandidate(candidate) ? state : undefined}
                      selectedIntent={selectedIntents[0] || null}
                      busy={busyId === id}
                      onPersonAction={onCardAction}
                      onOpenCommunity={(cid) => {
                        try {
                          window.dispatchEvent(new CustomEvent("ghc:navigate", { detail: { tab: "communities", communityId: cid } }))
                        } catch { /* */ }
                      }}
                      onOpenEvent={(_eid, communityId) => {
                        try {
                          window.dispatchEvent(new CustomEvent("ghc:navigate", { detail: { tab: "communities", communityId } }))
                        } catch { /* */ }
                      }}
                      onOpenActivity={(_aid, communityId) => {
                        try {
                          window.dispatchEvent(new CustomEvent("ghc:navigate", { detail: { tab: "communities", communityId } }))
                        } catch { /* */ }
                      }}
                      onOpenService={() => {
                        try {
                          window.dispatchEvent(new CustomEvent("ghc:navigate", { detail: { tab: "profile" } }))
                        } catch { /* */ }
                      }}
                    />
                  </div>
                )
              }
              if (!isPersonCandidate(candidate)) {
                return (
                  <div key={id}>
                    <DiscoveryObjectCard candidate={candidate} />
                  </div>
                )
              }
              const person = isPersonCandidate(candidate) ? candidate : null
              const legacy = {
                id: candidate.id,
                name: candidate.displayName,
                displayName: candidate.displayName,
                bio: candidate.subtitle || "",
                interests: person?.interests || [],
                location: person?.locationLabel || "",
                avatar: person?.avatarUrl || undefined,
                photos: person?.avatarUrl ? [person.avatarUrl] : [],
                _reason: formatReasonsForUi(candidate),
                _sharedInterests: candidate.reasons
                  .filter((r) => r.code === "shared_interest")
                  .map((r) => r.detail.replace(/^You both enjoy\s+/i, "")),
                _matchScore: candidate.rankScore,
              }
              return (
                <div key={id} className={busyId === id ? "pointer-events-none opacity-60" : undefined}>
                  <UserCard
                    candidate={legacy as any}
                    matchScore={undefined}
                    matchReason={legacy._reason}
                    mutualInterestNames={legacy._sharedInterests}
                    onViewProfile={() => onCardAction("view_profile", candidate)}
                    onLike={() => void onLike(id)}
                    onPass={() => void onPass(id)}
                    onMessage={() => onCardAction("message", candidate)}
                    onBlock={() => ghc.blockUser?.(id)}
                    onReport={() => ghc.reportContent?.("user", id, "discover")}
                    userInterests={userInterests}
                    userLocation={userLocation || undefined}
                    userAge={ghc.profile?.age}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      <ConnectionIntentPicker
        open={!!pickerTarget}
        targetName={pickerTarget?.name}
        defaultIntents={selectedIntents.slice(0, 3)}
        busy={connectBusy}
        error={connectError}
        onConfirm={(r) => void confirmConnect(r)}
        onCancel={() => {
          if (!connectBusy) {
            setPickerTarget(null)
            setConnectError(null)
          }
        }}
      />
    </div>
  )
}

export default DiscoveryGridScreen
