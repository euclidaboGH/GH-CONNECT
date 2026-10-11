"use client"

/**
 * Matches — mutual interest opportunities.
 * Like/Interest ≠ Connection. Use Connect → intent picker → unified request.
 */

import { useMemo, useState, useEffect, useCallback } from "react"
import { useGHC } from "@/contexts/ghc-context"
import { getUnifiedConnectionState } from "@/lib/domains/adapters/unified-connection-request"
import { IdentityService } from "@/lib/identity/identity-service"
import { ConnectionRequestInbox } from "./connection-request-inbox"
import { ConnectionIntentPicker } from "./connection-intent-picker"
import {
  submitConnectionFromPicker,
  userFacingConnectError,
} from "@/lib/domains/adapters/connection-connect-flow"
import type { ConnectionIntentId } from "@/lib/connection-intents"
import { onCloseTransientUI } from "@/lib/transient-ui"
import { asArray } from "@/lib/safe-data"
import { resolveUserIntents } from "@/lib/connection-intents"
import { filterValidMatches } from "@/lib/regression-guards"
import { Heart } from "lucide-react"
import type { MatchEntry, Like, Candidate, MatchIntention } from "@/lib/ghc-types"
import {
  EmptyMatchesState,
  MatchCard,
  MatchCardSkeleton,
  MatchTabs,
  MatchIntentionFilters,
  resolveMatchIntention,
} from "./matches-components"
import { EmptyState } from "./empty-state"
import { useScrollHeader } from "@/lib/use-scroll-header"
import { CollapsingAppHeader } from "./collapsing-app-header"

export function MatchScreen() {
  const {
    matches,
    likes,
    profile,
    candidates,
    startConversation,
    sendMessage,
    conversations,
    addToast,
    setTab,
    friends = [],
    blockedUsers = [],
    rejectMatch,
  } = useGHC() as any
  const [activeTab, setActiveTab] = useState<"new" | "all">("new")
  const [intentionFilter, setIntentionFilter] = useState<MatchIntention | "all">("all")
  const [removedMatches, setRemovedMatches] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showRequestInbox, setShowRequestInbox] = useState(false)
  const [pickerTarget, setPickerTarget] = useState<{ userId: string; userName: string } | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [connectBusy, setConnectBusy] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const meId = IdentityService.getCurrentUserId()
  const { compact: headerCompact, hidden: headerHidden, onScroll: onHeaderScroll } = useScrollHeader({ threshold: 36 })

  useEffect(() => {
    const open = () => setShowRequestInbox(true)
    window.addEventListener("ghc:open-connection-inbox", open as EventListener)
    return () => window.removeEventListener("ghc:open-connection-inbox", open as EventListener)
  }, [])

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

  useEffect(() => {
    if (!showRequestInbox && !pickerTarget) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (connectBusy) return
      if (pickerTarget) {
        setPickerTarget(null)
        setConnectError(null)
        return
      }
      if (showRequestInbox) setShowRequestInbox(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [showRequestInbox, pickerTarget, connectBusy])

  const handleConnectMatch = (match: { userId: string; userName: string }) => {
    setConnectError(null)
    setPickerTarget({ userId: match.userId, userName: match.userName })
  }

  const confirmMatchConnect = async (result: { intents: ConnectionIntentId[]; note?: string }) => {
    if (!pickerTarget) return
    setConnectBusy(true)
    setConnectError(null)
    try {
      const r = await submitConnectionFromPicker(
        meId,
        {
          userId: pickerTarget.userId,
          displayName: pickerTarget.userName,
          source: "match",
          blockedUserIds: blockedUsers || [],
        },
        result.intents,
        result.note
      )
      if (!r.ok) {
        setConnectError(userFacingConnectError(r.code || r.error))
        return
      }
      setPickerTarget(null)
      setStatusMsg("Connection request sent")
      window.setTimeout(() => setStatusMsg(null), 2000)
      addToast(`Connection request sent to ${pickerTarget.userName}`, "success")
    } catch {
      setConnectError(userFacingConnectError("REQUEST_FAILED"))
    } finally {
      setConnectBusy(false)
    }
  }


  const safeMatches = filterValidMatches(matches)
  const safeLikes = asArray<Like>(likes)
  const safeCandidates = asArray<Candidate>(candidates)

  // Prefer mutual likes when present; otherwise show graph matches (intentional matches domain)
  const viewerIds = new Set(
    [meId, "current-user"].filter((id): id is string => Boolean(id && String(id).trim()))
  )
  const blockedSet = new Set((blockedUsers || []).map(String))
  const mutualMatches = safeMatches.filter((match) => {
    if (blockedSet.has(String(match.userId))) return false
    const hasLikeData = safeLikes.length > 0
    if (!hasLikeData) return true
    const iLiked = safeLikes.some(
      (like) => viewerIds.has(String(like.fromUserId)) && String(like.toUserId) === String(match.userId)
    )
    const theyLiked = safeLikes.some(
      (like) => String(like.fromUserId) === String(match.userId) && viewerIds.has(String(like.toUserId))
    )
    return iLiked && theyLiked
  })

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 350)
    return () => window.clearTimeout(timer)
  }, [safeMatches.length])

  // Clear local Match UI when leaving the section
  useEffect(() => {
    return onCloseTransientUI((detail) => {
      const next = detail?.tab
      if (next && next !== "matches") {
        setActiveTab("new")
        setIntentionFilter("all")
      }
    })
  }, [])

  const sortMatches = (items: typeof safeMatches) =>
    [...items].sort((a, b) => Number(b.online) - Number(a.online) || b.matchedAt - a.matchedAt)

  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const baseAll = sortMatches(mutualMatches.filter((m) => !removedMatches.includes(m.id)))
  const baseNew = sortMatches(baseAll.filter((m) => now - m.matchedAt < day))

  const filterByIntention = (items: typeof safeMatches) => {
    if (intentionFilter === "all") return items
    return items.filter((m) => {
      const cand = safeCandidates.find((c) => c.id === m.userId)
      return resolveMatchIntention(m as any, cand) === intentionFilter
    })
  }

  const newMatches = filterByIntention(baseNew)
  const allMatches = filterByIntention(baseAll)
  const displayMatches = activeTab === "new" ? newMatches : allMatches

  const intentionCounts = useMemo(() => {
    const counts: Partial<Record<MatchIntention | "all", number>> = { all: baseAll.length }
    for (const m of baseAll) {
      const cand = safeCandidates.find((c) => c.id === m.userId)
      const intent = resolveMatchIntention(m as any, cand)
      counts[intent] = (counts[intent] || 0) + 1
    }
    return counts
  }, [baseAll, safeCandidates])

  const getCandidateData = (userId: string) => safeCandidates.find((c) => c.id === userId)


  const handleMessage = async (match: (typeof matches)[0]) => {
    const cand = getCandidateData(match.userId)
    const intention = resolveMatchIntention(match as any, cand)
    const metaLabel =
      intention === "professional"
        ? "Professional"
        : intention === "friendship"
          ? "Friendship"
          : intention === "dating"
            ? "Dating"
            : intention === "collaboration"
              ? "Collaboration"
              : intention === "mentorship"
                ? "Mentorship"
                : intention === "learning"
                  ? "Learning"
                  : "shared interests"
    const existing = (conversations || []).find(
      (c: { participantId?: string; conversationType?: string }) =>
        c.participantId === match.userId && c.conversationType === "private"
    )
    const convId = await startConversation(match.userId, match.userName, match.userPhoto)
    if (convId && !existing && typeof sendMessage === "function" && !isOffline) {
      try {
        await sendMessage(convId, `You matched on ${metaLabel}. Looking forward to connecting.`)
      } catch {
        /* non-blocking */
      }
    }
    setStatusMsg("Chat opened")
    window.setTimeout(() => setStatusMsg(null), 1500)
    addToast(`Chat opened · You matched on ${metaLabel}`, "success")
  }

  const handleRemoveMatch = async (match: { id: string; userId: string; userName?: string }) => {
    setRemovedMatches((prev) => (prev.includes(match.id) ? prev : [...prev, match.id]))
    setStatusMsg("Updating match list…")
    try {
      if (typeof rejectMatch === "function") {
        await rejectMatch(match.userId)
        setStatusMsg("Match removed")
        window.setTimeout(() => setStatusMsg(null), 2000)
        return
      }
      setStatusMsg("Hidden on this device")
      window.setTimeout(() => setStatusMsg(null), 2000)
      addToast("Match hidden on this device — server unmatch unavailable", "info")
    } catch {
      setStatusMsg("Could not remove match")
      window.setTimeout(() => setStatusMsg(null), 2500)
      addToast("Could not remove match. Try again.", "error")
    }
  }

  const handleStartSwiping = () => {
    setTab("discover")
    addToast("Matches are mutual interest only — express interest on Find", "info")
  }

  if (!isLoading && mutualMatches.length === 0) {
    return (
      <div className="relative flex h-full flex-col bg-background text-foreground pb-3">
        <CollapsingAppHeader
          title="Matches"
          subtitle="Mutual interest — not auto-friends"
          compact={false}
          hidden={false}
          compactLeading={
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--gh-green)] text-white">
              <Heart size={14} />
            </div>
          }
        />
        <div className="flex flex-1 items-center justify-center">
          <EmptyMatchesState onStartSwiping={handleStartSwiping} />
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col bg-background text-foreground pb-3">
      <CollapsingAppHeader
        title="Matches"
        subtitle={`${baseAll.length} intentional match${baseAll.length === 1 ? "" : "es"}`}
        compact={headerCompact}
        hidden={headerHidden}
        compactLeading={
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--gh-green)] text-white">
            <Heart size={14} />
          </div>
        }
        actions={
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            {baseAll.length}
          </span>
        }
        secondary={
          <div className="space-y-2">
            <MatchTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              newCount={baseNew.length}
              totalCount={baseAll.length}
            />
            <MatchIntentionFilters
              active={intentionFilter}
              onChange={setIntentionFilter}
              counts={intentionCounts}
            />
            <p className="text-[12px] leading-relaxed text-stone-600">
              A Match is mutual interest — not automatic friendship or a compatibility score. Follow and Connect are different.
            </p>
            <button
              type="button"
              onClick={() => setShowRequestInbox(true)}
              className="w-full rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-left text-[12px] font-semibold text-emerald-900 transition hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100"
            >
              Connection requests inbox
            </button>
          </div>
        }
      />

      <div className="sr-only" role="status" aria-live="polite">
        {statusMsg || (isLoading ? "Loading matches" : "")}
      </div>
      {isOffline ? (
        <div
          className="mx-3 mt-2 rounded-[1.25rem] border border-amber-200/80 bg-amber-50/90 px-3.5 py-2 text-[11px] leading-snug text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          You are offline. Matches already on this device stay visible; new mutual interest and connection requests sync when you reconnect.
        </div>
      ) : null}

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide" onScroll={onHeaderScroll}>
        {isLoading ? (
          <div className="flex flex-col gap-3 px-4 pb-6 pt-4">
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
            <MatchCardSkeleton />
          </div>
        ) : displayMatches.length === 0 ? (
          <EmptyState
            variant="matches"
            title={
              activeTab === "new"
                ? "No new matches"
                : intentionFilter !== "all"
                  ? "No matches for this intention"
                  : "No matches yet"
            }
            description={
              activeTab === "new"
                ? "New mutual interests from the last 24 hours show up here. Dating · Friendship · Pro · Mentor are intentional types — not automatic friends."
                : "A match means mutual intentional interest. Open Find to express interest in people who fit your goals."
            }
            action={{ label: "Express interest on Find", onClick: handleStartSwiping }}
          />
        ) : (
          <div className="flex flex-col gap-3 px-4 pb-6 pt-4" role="list" aria-label="Matches">
            <p className="text-[11px] font-medium text-muted-foreground" aria-live="polite">
              {displayMatches.length} match{displayMatches.length === 1 ? "" : "es"}
              {activeTab === "new" ? " · new" : ""}
              {intentionFilter !== "all" ? " · filtered" : ""}
            </p>
            {displayMatches.map((match, index) => (
              <div key={match.id} role="listitem">
              <MatchCard
                match={match}
                userInterests={Array.isArray(profile?.interests) ? profile.interests : []}
                candidateData={getCandidateData(match.userId)}
                onMessage={() => void handleMessage(match)}
                onRemove={() => void handleRemoveMatch(match)}
                onConnect={() => void handleConnectMatch(match)}
                connectionState={getUnifiedConnectionState(meId, match.userId, {
                  friends: friends as string[],
                  blockedUsers: blockedUsers as string[],
                })}
                onOpenProfile={() => {
                  window.dispatchEvent(
                    new CustomEvent("ghc:open-profile", { detail: { userId: match.userId, name: match.userName } })
                  )
                  setTab?.("profile")
                  addToast(`Viewing ${match.userName}`, "info")
                }}
                animationDelay={Math.min(index, 5) * 70}
              />
              </div>
            ))}
          </div>
        )}
      </div>

      {showRequestInbox ? (
        <div className="absolute inset-0 z-40 bg-background/95 backdrop-blur-sm">
          <ConnectionRequestInbox onClose={() => setShowRequestInbox(false)} />
        </div>
      ) : null}

      <ConnectionIntentPicker
        open={!!pickerTarget}
        targetName={pickerTarget?.userName}
        defaultIntents={resolveUserIntents(meId, null).slice(0, 3)}
        busy={connectBusy}
        error={connectError}
        onConfirm={(r) => void confirmMatchConnect(r)}
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
