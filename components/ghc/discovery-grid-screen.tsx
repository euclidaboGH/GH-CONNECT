"use client"

/**
 * Discover — connection-intent discovery (not dating-only).
 * Wired to DiscoveryCandidate contract + explainable reasons (Prompt #37).
 * Never manufactures candidates; production filters studio seeds.
 */

import { useMemo, useState, useCallback, startTransition } from "react"
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

  const userInterests = Array.isArray(ghc.profile?.interests) ? ghc.profile!.interests! : []
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
        ghc.addToast?.(
          "Interest expressed — a match is an opportunity, not an automatic connection",
          "success"
        )
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
      } catch {
        /* */
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
    [ghc, onLike, onPass, onConnect, meId],
  )

  const emptyCopy = discoveryEmptyState(category)
  const loading = Boolean(ghc.loading)
  const error = ghc.error

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground contain-content">
      <header className="gh-page-header-slim">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-[14px] font-bold leading-none tracking-tight">Discover</h1>
          </div>
          <div className="flex min-w-0 flex-[1.4] items-center gap-1.5 rounded-full border border-border/50 bg-muted/40 px-2.5 py-1">
            <Search size={13} className="shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people"
              className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
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
            aria-label="Filters"
            title="Connection filters below"
          >
            <SlidersHorizontal size={13} />
          </button>
        </div>
      </header>
      <div className="px-3 pt-2">
        <div className="rounded-2xl border border-border/60 bg-card/90 px-3 py-2">
          <p className="text-[12px] font-bold text-foreground">Discover with intent</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Friendship, work, mentoring, and communities — not a dating-only feed. Cards explain why they appear.
          </p>
        </div>
      </div>


      <ConnectionModeBar
        selectedIntents={selectedIntents}
        onIntentsChange={(ids) => onIntentsChange(ids as ConnectionIntentId[])}
      />

      <div
        className="flex gap-1.5 overflow-x-auto px-3 pb-2 scrollbar-hide"
        role="tablist"
        aria-label="Discovery categories"
      >
        {DISCOVERY_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={category === cat.id}
            onClick={() => setCategory(cat.id)}
            className={
              category === cat.id
                ? "shrink-0 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
                : "shrink-0 rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
            }
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 gh-scroll-root overflow-y-auto px-3 pb-24 pt-1">
        {loading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading discovery">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/50" />
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
        ) : (adapted.mode === "typed" ? adapted.typedList.length === 0 : adapted.list.length === 0) ? (
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
              label: "Clear filters",
              onClick: () => {
                onIntentsChange([])
                setQuery("")
                setCategory("people")
              },
            }}
          />
        ) : (
          <div className="mx-auto flex max-w-[var(--gh-content-max,28rem)] flex-col gap-2.5 pb-2">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <p className="text-[11px] font-medium text-muted-foreground">
                {adapted.mode === "typed" ? adapted.typedList.length : adapted.list.length} {category} · explainable — real sources only
              </p>
              <button
                type="button"
                className="text-[10px] font-medium text-primary"
                onClick={() => setUseModernCard((v) => !v)}
              >
                {useModernCard ? "Classic cards" : "Connection cards"}
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
