"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  type GHCCommunity,
  type BoardPostKind,
  type CommunityPrivacy,
  loadCommunities,
  saveCommunities,
  createCommunityRecord,
  joinCommunity,
  leaveCommunity,
  muteCommunity,
  addBoardPost,
  addEvent,
  rsvpEvent,
  approveJoinRequest,
  isMember,
  roleOf,
  scoreCommunity,
  nextEventLabel,
} from "@/lib/domains/community-registry"
import { useGHC } from "@/contexts/ghc-context"

export function useCommunities() {
  const { profile, addToast } = useGHC()
  const [communities, setCommunities] = useState<GHCCommunity[]>([])
  const [ready, setReady] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const list = loadCommunities()
    setCommunities(list)
    setReady(true)
  }, [])

  const persist = useCallback((next: GHCCommunity[]) => {
    setCommunities(next)
    saveCommunities(next)
  }, [])

  const selected = useMemo(
    () => (selectedId ? communities.find((c) => c.id === selectedId) || null : null),
    [communities, selectedId],
  )

  const myCommunities = useMemo(
    () =>
      communities
        .filter((c) => isMember(c) && !c.mutedBy.includes("current-user"))
        .sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0)),
    [communities],
  )

  const discoverCommunities = useMemo(() => {
    const profileCtx = {
      city: (profile as { city?: string })?.city || (profile as { location?: string })?.location,
      country: (profile as { country?: string })?.country,
      interests: (profile as { interests?: string[] })?.interests || [],
      continent: (profile as { continent?: string })?.continent,
    }
    return [...communities]
      .filter((c) => !isMember(c) || c.isSample)
      .sort((a, b) => scoreCommunity(b, profileCtx) - scoreCommunity(a, profileCtx))
  }, [communities, profile])

  const create = useCallback(
    async (input: {
      name: string
      purpose?: string
      description?: string
      category?: string
      region?: string
      privacy?: CommunityPrivacy
      coverImage?: string
      welcomeMessage?: string
      rules?: string[]
      tags?: string[]
    }) => {
      const rec = createCommunityRecord(input)
      const next = [rec, ...communities]
      persist(next)
      setSelectedId(rec.id)
      const isFirst = !communities.some((c) => !c.isSample && c.createdBy === "current-user")
      addToast(
        isFirst
          ? `"${rec.name}" is live — your first community space 🎉`
          : `"${rec.name}" created`,
        "success",
      )
      return rec.id
    },
    [communities, persist, addToast],
  )

  const join = useCallback(
    (communityId: string) => {
      const c = communities.find((x) => x.id === communityId)
      if (!c) return
      const next = joinCommunity(communities, communityId)
      persist(next)
      if (c.privacy === "invite-only" && !isMember(c)) {
        addToast(`Request sent to join ${c.name}`, "info")
      } else {
        addToast(`Joined ${c.name}`, "success")
        setSelectedId(communityId)
      }
    },
    [communities, persist, addToast],
  )

  const leave = useCallback(
    (communityId: string) => {
      const c = communities.find((x) => x.id === communityId)
      if (!c) return
      if (c.createdBy === "current-user") {
        addToast("Transfer ownership before leaving a community you own", "error")
        return
      }
      persist(leaveCommunity(communities, communityId))
      if (selectedId === communityId) setSelectedId(null)
      addToast(`Left ${c.name}`, "info")
    },
    [communities, persist, selectedId, addToast],
  )

  const mute = useCallback(
    (communityId: string) => {
      const c = communities.find((x) => x.id === communityId)
      persist(muteCommunity(communities, communityId))
      const nowMuted = c && !c.mutedBy.includes("current-user")
      addToast(nowMuted ? `Muted ${c?.name}` : `Unmuted ${c?.name}`, "info")
    },
    [communities, persist, addToast],
  )

  const postToBoard = useCallback(
    (communityId: string, body: string, kind: BoardPostKind = "text") => {
      if (!body.trim()) return
      persist(addBoardPost(communities, communityId, body, kind, profile?.displayName || "You"))
      addToast("Posted to board", "success")
    },
    [communities, persist, profile, addToast],
  )

  const createEvent = useCallback(
    (
      communityId: string,
      input: { title: string; startsAt: number; location?: string; isOnline?: boolean; description?: string },
    ) => {
      persist(addEvent(communities, communityId, input))
      addToast("Event created", "success")
    },
    [communities, persist, addToast],
  )

  const toggleRsvp = useCallback(
    (communityId: string, eventId: string) => {
      persist(rsvpEvent(communities, communityId, eventId))
    },
    [communities, persist],
  )

  const approveRequest = useCallback(
    (communityId: string, userId: string) => {
      persist(approveJoinRequest(communities, communityId, userId))
      addToast("Join request approved", "success")
    },
    [communities, persist, addToast],
  )

  return {
    ready,
    communities,
    myCommunities,
    discoverCommunities,
    selected,
    selectedId,
    setSelectedId,
    create,
    join,
    leave,
    mute,
    postToBoard,
    createEvent,
    toggleRsvp,
    approveRequest,
    isMember: (c: GHCCommunity) => isMember(c),
    roleOf: (c: GHCCommunity) => roleOf(c),
    nextEventLabel,
    scoreCommunity,
  }
}
