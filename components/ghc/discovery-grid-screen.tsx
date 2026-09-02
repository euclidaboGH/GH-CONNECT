"use client"

/** Discover 0.58 — modern profile cards */
/**
 * Discover — connection-intent discovery (not dating-only).
 * Slim chrome, safer candidate normalization, clear empty states.
 */
import { useMemo, useState, useCallback, startTransition } from "react"
import { useGHCDiscovery } from "@/contexts/ghc-context"
import { ConnectionModeBar, candidateMatchesIntents } from "./discovery-components"
import { UserCard, calculateMatchScore } from "./user-card"
import { EmptyState } from "./empty-state"
import { Search, SlidersHorizontal, X } from "lucide-react"
import {
  resolveUserIntents,
  scoreIntentMatch,
  saveConnectionIntents,
  type ConnectionIntentId,
} from "@/lib/connection-intents"
import { IdentityService } from "@/lib/identity/identity-service"

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
    }
    swipe?: (id: string, dir: string) => Promise<void>
    blockUser?: (id: string) => void
    addToast?: (m: string, t?: string) => void
    reportContent?: (kind: string, id: string, reason: string) => void
    startConversation?: (userId: string, userName?: string, userPhoto?: string) => Promise<string | null>
  }
  const meId = IdentityService.getCurrentUserId()
  const profileIntents = resolveUserIntents(meId, ghc.profile as any)
  const [selectedIntents, setSelectedIntents] = useState<ConnectionIntentId[]>(() => profileIntents)
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
  const [busyId, setBusyId] = useState<string | null>(null)

  const userInterests = Array.isArray(ghc.profile?.interests) ? ghc.profile!.interests! : []
  const userLocation = [ghc.profile?.city, ghc.profile?.country].filter(Boolean).join(", ")

  const list = useMemo(() => {
    const raw = Array.isArray(ghc.candidates) ? ghc.candidates : []
    const q = query.trim().toLowerCase()
    const filterIntents = selectedIntents.length ? selectedIntents : profileIntents
    return raw
      .filter((c) => c && c.id && c.id !== "current-user" && c.id !== meId)
      .filter((c) => {
        try {
          return candidateMatchesIntents(c, selectedIntents)
        } catch {
          return true
        }
      })
      .filter((c) => {
        if (!q) return true
        const interests = Array.isArray(c.interests) ? c.interests : []
        const blob = `${c.name || c.displayName || ""} ${c.bio || ""} ${interests.join(" ")} ${c.location || ""}`.toLowerCase()
        return blob.includes(q)
      })
      .map((candidate) => {
        const interests = Array.isArray(candidate?.interests) ? candidate.interests.filter(Boolean) : []
        const name = candidate?.name || candidate?.displayName || "Member"
        const intentBoost = scoreIntentMatch(filterIntents, candidate)
        const baseScore = calculateMatchScore(
          { ...candidate, interests, name } as any,
          userInterests,
          ghc.profile?.age,
          userLocation || undefined,
        )
        const score = baseScore + intentBoost * 4
        const shared = interests
          .filter((i: string) =>
            userInterests.some((u) => String(u).toLowerCase() === String(i).toLowerCase()),
          )
          .slice(0, 3)
        const intentLabels = filterIntents.slice(0, 2).join(" · ")
        return {
          ...candidate,
          interests,
          name,
          bio: candidate?.bio || "",
          _matchScore: score,
          _sharedInterests: shared,
          _reason:
            shared.length > 0
              ? `Shared: ${shared.join(" · ")}`
              : intentBoost > 0 && intentLabels
                ? `Aligned: ${intentLabels}`
                : candidate?.location
                  ? `Near ${candidate.location}`
                  : "Recommended for you",
        }
      })
      .sort((a, b) => (b._matchScore || 0) - (a._matchScore || 0))
      .slice(0, 36)
  }, [ghc.candidates, selectedIntents, profileIntents, query, userInterests, userLocation, ghc.profile?.age, meId])

  const onLike = useCallback(
    async (id: string) => {
      if (busyId) return
      setBusyId(id)
      try {
        await ghc.swipe?.(id, "like")
        ghc.addToast?.("Interest expressed — matches when they like you back", "success")
      } catch {
        ghc.addToast?.("Could not send interest", "error")
      } finally {
        setBusyId(null)
      }
    },
    [busyId, ghc],
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

      <ConnectionModeBar
        selectedIntents={selectedIntents}
        onIntentsChange={(ids) => onIntentsChange(ids as ConnectionIntentId[])}
      />

      <div
        className="gh-scroll-root gh-scroll-stable px-2.5 pt-1.5 sm:px-3"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {list.length === 0 ? (
          <EmptyState
            variant="discover"
            title={query ? "No people match your search" : "No people to show yet"}
            description={
              query
                ? "Try another name or interest, or clear search."
                : "Choose connection intents above, add interests on your profile, or clear filters."
            }
            action={{
              label: query ? "Clear search" : "Edit interests",
              onClick: () => {
                if (query) {
                  setQuery("")
                  return
                }
                try {
                  window.dispatchEvent(
                    new CustomEvent("ghc:open-settings", { detail: { section: "profile" } }),
                  )
                } catch {
                  /* */
                }
              },
            }}
            secondaryAction={{
              label: "Clear intent filters",
              onClick: () => onIntentsChange([]),
            }}
          />
        ) : (
          <div className="mx-auto flex max-w-[var(--gh-content-max,28rem)] flex-col gap-2.5 pb-2">
            <p className="px-0.5 text-[11px] font-medium text-muted-foreground">
              {list.length} people · connect, network & communities — not dating-only
            </p>
            {list.map((candidate) => {
              const safe = candidate
              const id = String(safe.id || safe.name)
              return (
                <div key={id} className={busyId === id ? "opacity-60 pointer-events-none" : undefined}>
                  <UserCard
                    candidate={safe}
                    matchScore={safe._matchScore}
                    matchReason={safe._reason}
                    mutualInterestNames={safe._sharedInterests}
                    onViewProfile={() => {
                      try {
                        window.dispatchEvent(
                          new CustomEvent("ghc:open-profile", { detail: { userId: safe.id } }),
                        )
                      } catch {
                        /* */
                      }
                    }}
                    onLike={() => void onLike(id)}
                    onPass={() => void onPass(id)}
                    onMessage={() => {
                      startTransition(() => {
                        try {
                          ghc.startConversation?.(String(safe.id))
                          window.dispatchEvent(
                            new CustomEvent("ghc:navigate-tab", { detail: "messages" }),
                          )
                        } catch {
                          window.dispatchEvent(
                            new CustomEvent("ghc:start-chat", {
                              detail: { userId: safe.id, name: safe.name },
                            }),
                          )
                        }
                      })
                    }}
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
    </div>
  )
}

export default DiscoveryGridScreen
