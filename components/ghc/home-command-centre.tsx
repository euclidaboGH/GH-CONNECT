"use client"

import { DurableImage } from "./durable-image"
/**
 * Home top — greeting + daily reward + command-centre foundation sections.
 * Creating content is handled by the bottom navigation Create (+) button.
 * Production never injects demo people/communities into these cards.
 */

import { useMemo } from "react"
import { useGHCProfile, useGHCMessaging, useGHCFeed } from "@/contexts/ghc-context"
import { listMyCommunitiesForHome } from "@/lib/domains/adapters/my-communities-home"
import { Calendar } from "lucide-react"
import { listInvitationsForViewer } from "@/lib/domains/adapters/community-invites-adapter"
import { buildHomeCommunityPulse } from "@/lib/domains/adapters/home-community-pulse"
import { IdentityService } from "@/lib/identity/identity-service"
import { useGHC } from "@/contexts/ghc-context"
import { useRegionalContext } from "@/contexts/regional-context"
import { getExperienceMessage } from "@/lib/i18n/experience"
import { CommunityInviteCard } from "@/components/ghc/community-invite-card"
import {
  createIdentitySeam,
  createConnectionsSeam,
  createMessagingSeam,
  createFeedSeam,
} from "@/lib/domains/adapters/ghc-context-seams"
import { isDemoDataAllowed } from "@/lib/demo-data-policy"
import { Users, MessagesSquare, Compass, ArrowRight, Sparkles, Camera, Video, PenLine, MoreHorizontal } from "lucide-react"
import { resolveHomeNextAction } from "@/lib/domains/adapters/home-next-action"
import { buildHomeActivationChecklist } from "@/lib/domains/adapters/home-activation-checklist"
import { HomeActivationChecklist } from "@/components/ghc/home-activation-checklist"
import { buildHomeJourney } from "@/lib/home-journey"
import { buildHomeResultMetrics } from "@/lib/home-results"
import { HomeResultsStrip } from "@/components/ghc/home-results-strip"
import { HomeOutcomePanel } from "@/components/ghc/home-outcome-panel"
import { navigateTo, openCommunity } from "@/lib/navigation/navigate"
import { HomeCrossFeaturePath } from "@/components/ghc/home-cross-feature-path"
import { buildHomeCrossFeatureSignals } from "@/lib/home-cross-feature"
import { useWalletRead } from "@/contexts/domains/wallet-read-provider"
import { useDailyClaimStatus } from "@/components/ghc/use-daily-claim-status"

function timeGreeting(now = new Date(), locale = "en-US"): string {
  const h = now.getHours()
  const key = h < 5 || h >= 21 ? "homeNight" : h < 12 ? "homeMorning" : h < 17 ? "homeAfternoon" : "homeEvening"
  return getExperienceMessage(key, locale)
}

function firstName(displayName?: string | null, fallback = "there"): string {
  const n = (displayName || "").trim()
  if (!n) return fallback
  return n.split(/\s+/)[0]
}

function goTab(tab: string) {
  // Canonical destination map (tabs + overlays)
  if (!navigateTo(tab)) {
    try {
      window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: tab }))
      window.dispatchEvent(new CustomEvent("ghc:navigate", { detail: { tab } }))
    } catch {
      /* */
    }
  }
}

function MiniCard({
  title,
  body,
  action,
  onAction,
  icon: Icon,
}: {
  title: string
  body: string
  action: string
  onAction: () => void
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-border/50 bg-card/70 p-2.5">
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span className="text-[11px] font-semibold text-foreground">{title}</span>
      </div>
      <p className="mb-1.5 line-clamp-2 flex-1 text-[10px] leading-snug text-muted-foreground">{body}</p>
      <button
        type="button"
        onClick={onAction}
        className="self-start text-[10px] font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
      >
        {action}
      </button>
    </div>
  )
}

export function HomeCommandCentre({
  onCompose: _onCompose,
}: {
  onCompose?: (kind?: string) => void
  onOpenDiscover?: () => void
  onOpenCommunities?: () => void
  onOpenRewards?: () => void
}) {
  const regional = useRegionalContext()
  const ghcSession = useGHC() as any
  const meId = IdentityService.getCurrentUserId()
  const conversations = (ghcSession.conversations || []) as any[]
  const blockedUserIds = (ghcSession.blockedUsers || []) as string[]
  const acceptCommunityInvitation = ghcSession.acceptCommunityInvitation as (
    communityId: string
  ) => Promise<boolean>
  const declineCommunityInvitation = ghcSession.declineCommunityInvitation as (
    communityId: string
  ) => Promise<boolean>
  const myCommunities = listMyCommunitiesForHome(conversations, meId, {
    blockedUserIds,
    limit: 6,
  })
  const invites = listInvitationsForViewer(conversations, meId, {
    blockedUserIds,
  }).filter((i: { status: string }) => i.status === "invited")
  const communityPulse = buildHomeCommunityPulse({
    viewerId: meId,
    conversations,
    blockedUserIds,
    maxItems: 3,
  })


  const ghc = useGHCProfile() as {
    profile?: {
      displayName?: string
      photos?: string[]
      bio?: string
      interests?: string[]
      friends?: unknown[]
      following?: unknown[]
      onboarded?: boolean
      profession?: string
      ghId?: string
      username?: string
      avatar?: string
      id?: string
    }
  }
  const profile = ghc.profile
  const messaging = useGHCMessaging() as { conversations?: unknown[]; inbox?: unknown[] }
  const feedCtx = useGHCFeed() as { posts?: unknown[] }

  const greet = useMemo(() => timeGreeting(new Date(), regional.locale), [regional.locale])
  const name = firstName(profile?.displayName, getExperienceMessage("there", regional.locale))
  const avatar = profile?.photos?.[0] || profile?.avatar

  const identity = useMemo(() => createIdentitySeam(() => profile || null), [profile])
  const connections = useMemo(
    () =>
      createConnectionsSeam(() => ({
        friendsCount: Array.isArray(profile?.friends) ? profile!.friends!.length : 0,
        followingCount: Array.isArray(profile?.following) ? profile!.following!.length : 0,
        followersCount: 0,
        pendingRequestsCount: 0,
      })),
    [profile]
  )
  const inbox = useMemo(() => {
    const convos = messaging?.conversations || messaging?.inbox || []
    return createMessagingSeam(() => (Array.isArray(convos) ? (convos as any) : []))
  }, [messaging])
  const feedSeam = useMemo(() => {
    const posts = feedCtx?.posts || []
    return createFeedSeam(() => (Array.isArray(posts) ? (posts as any) : []))
  }, [feedCtx])

  const snap = identity.getSnapshot()
  const summary = connections.getSummary()
  const needAttention = inbox.conversationsNeedingAttention()
  const completion =
    snap.ok && snap.data.profileCompletionPercent < 100 ? snap.data.profileCompletionPercent : null

  const networkBody =
    summary.ok && (summary.data.friendsCount > 0 || summary.data.followingCount > 0)
      ? `${summary.data.friendsCount} friends · ${summary.data.followingCount} following`
      : connections.emptyNetworkState().description

  const messagesBody =
    needAttention.ok && needAttention.data.length > 0
      ? `${needAttention.data.length} need attention`
      : inbox.emptyInboxState().description

  const attentionCount =
    needAttention.ok && Array.isArray(needAttention.data) ? needAttention.data.length : 0
  const friendsOrFollowing =
    summary.ok
      ? (summary.data.friendsCount || 0) + (summary.data.followingCount || 0)
      : 0
  const meIds = useMemo(() => {
    const ids = new Set<string>()
    const a = (meId || "").trim()
    if (a) ids.add(a)
    const pid = (profile?.id || "").trim()
    if (pid) ids.add(pid)
    return ids
  }, [meId, profile?.id])

  const hasOwnPost = useMemo(() => {
    const posts = feedCtx?.posts
    if (!Array.isArray(posts) || meIds.size === 0) return false
    for (const raw of posts) {
      if (!raw || typeof raw !== "object") continue
      const p = raw as { authorId?: string; userId?: string }
      const aid = String(p.authorId || p.userId || "").trim()
      if (aid && meIds.has(aid)) return true
    }
    return false
  }, [feedCtx?.posts, meIds])

  const profileBio = profile?.bio
  const profileInterests = profile?.interests
  const hasBio = Boolean(profileBio && String(profileBio).trim().length > 0)
  const interestsCount = Array.isArray(profileInterests) ? profileInterests.length : 0

  const activationChecklist = useMemo(
    () =>
      buildHomeActivationChecklist({
        hasPhoto: Boolean(avatar),
        hasBio,
        interestsCount,
        myCommunitiesCount: myCommunities.length,
        hasOwnPost,
      }),
    [avatar, hasBio, interestsCount, myCommunities.length, hasOwnPost]
  )

  const journey = useMemo(() => buildHomeJourney({
    profileComplete: Boolean(completion === null && profile?.displayName?.trim() && avatar),
    hasDiscoverySignals: friendsOrFollowing > 0 || interestsCount > 0 || myCommunities.length > 0,
    hasConnection: friendsOrFollowing > 0,
    hasParticipation: hasOwnPost || myCommunities.length > 0,
  }), [completion, profile?.displayName, avatar, friendsOrFollowing, interestsCount, myCommunities.length, hasOwnPost])

  const resultMetrics = useMemo(() => buildHomeResultMetrics({
    profileCompletionPercent: completion,
    friendsCount: summary.ok ? summary.data.friendsCount : 0,
    followingCount: summary.ok ? summary.data.followingCount : 0,
    messagesNeedingAttention: attentionCount,
    communitiesCount: myCommunities.length,
  }), [completion, summary, attentionCount, myCommunities.length])

  const nextAction = resolveHomeNextAction({
    profileCompletionPercent: completion,
    messagesNeedingAttention: attentionCount,
    myCommunitiesCount: myCommunities.length,
    friendsOrFollowingCount: friendsOrFollowing,
    hasDisplayName: Boolean(profile?.displayName?.trim()),
    hasPhoto: Boolean(avatar),
  })

  const walletRead = useWalletRead()
  const dailyClaim = useDailyClaimStatus(meId || "", Boolean(meId))
  const crossFeatureSignals = useMemo(() => buildHomeCrossFeatureSignals({
    messagesNeedingAttention: attentionCount,
    communityInvites: invites.length,
    communitySignals: communityPulse.items.length,
    communitiesCount: myCommunities.length,
    friendsOrFollowing,
    profileCompletion: completion,
    hasOwnPost,
    interestsCount,
    dailyClaimable: Boolean(dailyClaim.status?.claimable),
    walletReady: walletRead.snapshot.source === "server" && walletRead.snapshot.status === "ready",
    pendingGhc: walletRead.snapshot.pendingGhc,
    lockedGhc: walletRead.snapshot.lockedGhc,
  }), [attentionCount, invites.length, communityPulse.items.length, myCommunities.length, friendsOrFollowing, completion, hasOwnPost, interestsCount, dailyClaim.status, walletRead.snapshot])


  return (
    <section className="space-y-3" aria-label="Home command centre">
      <header className="flex items-center gap-2.5 px-0.5 pb-0.5">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-emerald-100 ring-2 ring-background shadow-sm dark:bg-emerald-950">
          {avatar ? (
            <DurableImage src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[11px] font-bold text-emerald-800 dark:text-emerald-200">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold tracking-tight text-foreground">
            {greet}, {name}
          </p>
          {completion !== null && completion < 100 ? (
            <p className="truncate text-[11px] text-muted-foreground">
              Profile {completion}% complete
            </p>
          ) : null}
        </div>
      </header>

      {/* Create shortcuts — reference arrangement (Photo / Video / Post / More); real compose only */}
      <div
        className="grid grid-cols-4 gap-2 rounded-[1.25rem] border border-border/50 bg-card p-3 shadow-[var(--gh-card-shadow)]"
        role="group"
        aria-label="Create"
      >
        {(
          [
            {
              id: "photo",
              label: "Photo",
              icon: Camera,
              tile: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
              run: () => {
                try {
                  window.dispatchEvent(
                    new CustomEvent("ghc:open-compose", { detail: { mode: "post", attach: "photo" } })
                  )
                } catch {
                  window.dispatchEvent(new CustomEvent("ghc:open-create-hub"))
                }
              },
            },
            {
              id: "video",
              label: "Video",
              icon: Video,
              tile: "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
              run: () => {
                try {
                  window.dispatchEvent(
                    new CustomEvent("ghc:open-compose", { detail: { mode: "post", attach: "video" } })
                  )
                } catch {
                  window.dispatchEvent(new CustomEvent("ghc:open-create-hub"))
                }
              },
            },
            {
              id: "post",
              label: "Post",
              icon: PenLine,
              tile: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
              run: () => {
                try {
                  window.dispatchEvent(new CustomEvent("ghc:open-compose", { detail: { mode: "post" } }))
                } catch {
                  window.dispatchEvent(new CustomEvent("ghc:open-create-hub"))
                }
              },
            },
            {
              id: "more",
              label: "More",
              icon: MoreHorizontal,
              tile: "bg-muted text-foreground",
              run: () => {
                try {
                  window.dispatchEvent(new CustomEvent("ghc:open-create-hub"))
                } catch {
                  /* */
                }
              },
            },
          ] as const
        ).map((a) => {
          const Icon = a.icon
          return (
            <button
              key={a.id}
              type="button"
              onClick={a.run}
              aria-label={
                a.id === "more"
                  ? "More create options"
                  : a.id === "photo"
                    ? "Create post with photo"
                    : a.id === "video"
                      ? "Create post with video"
                      : "Create post"
              }
              className="flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-2xl bg-muted/30 px-1 py-2 transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.97]"
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${a.tile}`}>
                <Icon size={18} strokeWidth={2.25} aria-hidden />
              </span>
              <span className="text-[11px] font-bold text-foreground">{a.label}</span>
            </button>
          )
        })}
      </div>

      {!activationChecklist.complete ? (
        <HomeActivationChecklist checklist={activationChecklist} />
      ) : null}

      <HomeResultsStrip
        metrics={resultMetrics}
        onOpen={(id) => {
          if (id === "identity") goTab("profile")
          else if (id === "network") goTab("discover")
          else if (id === "messages") goTab("messages")
          else goTab("communities")
        }}
      />

      <HomeOutcomePanel
        action={nextAction}
        journey={journey}
        onAction={() => {
          if (nextAction.event) {
            if (nextAction.event === "ghc:open-wallet") {
              navigateTo("wallet")
              return
            }
            try { window.dispatchEvent(new CustomEvent(nextAction.event, { detail: {} })) } catch { /* */ }
            return
          }
          if (nextAction.target === "home") {
            try { window.dispatchEvent(new CustomEvent("ghc:focus-feed")) } catch { /* */ }
            return
          }
          goTab(nextAction.target)
        }}
      />

      <HomeCrossFeaturePath
        signals={crossFeatureSignals}
        onOpen={(signal) => {
          if (signal.target === "home") {
            try { window.dispatchEvent(new CustomEvent("ghc:open-compose", { detail: { mode: "post" } })) } catch { /* */ }
            return
          }
          goTab(signal.target)
        }}
      />

      {invites.length > 0 ? (
        <div className="space-y-2" aria-label={`${invites.length} community invitations`}>
          {invites.slice(0, 3).map((invite) => (
            <CommunityInviteCard
              key={invite.communityId}
              invite={invite}
              onAccept={() => acceptCommunityInvitation(invite.communityId)}
              onDecline={() => declineCommunityInvitation(invite.communityId)}
              onOpen={() => {
                try {
                  openCommunity(invite.communityId)
                } catch {
                  goTab("communities")
                }
              }}
            />
          ))}
          {invites.length > 3 ? (
            <button
              type="button"
              onClick={() => goTab("communities")}
              className="w-full text-center text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
            >
              Review all invites
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1.5" aria-label="My communities">
        <div className="flex items-center justify-between px-0.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            My communities
          </h3>
          <button
            type="button"
            onClick={() => goTab("communities")}
            className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
          >
            See all
          </button>
        </div>
        {myCommunities.length > 0 ? (
          <ul className="divide-y divide-border/40 rounded-xl border border-border/40 overflow-hidden">
            {myCommunities.slice(0, 3).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      openCommunity(c.id)
                    } catch {
                      goTab("communities")
                    }
                  }}
                  className="flex w-full min-h-11 items-center gap-2.5 bg-background px-2.5 py-2 text-left transition hover:bg-muted/40"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-[11px] font-bold text-foreground">
                    {c.coverImage ? (
                      <DurableImage src={c.coverImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (c.name || "C").slice(0, 1)
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                    {c.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <button
            type="button"
            onClick={() => goTab("communities")}
            className="w-full rounded-xl border border-dashed border-border/60 bg-muted/20 px-3 py-3 text-left transition hover:bg-muted/40"
          >
            <p className="text-[12px] font-medium text-foreground">
              {"You haven't joined a community yet"}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Browse communities that match your interests
            </p>
          </button>
        )}
      </div>

      {communityPulse.hasSignal ? (
        <div className="space-y-1.5" aria-label="Happening in your communities">
          <h3 className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Happening in your communities
          </h3>
          <ul className="space-y-1 rounded-xl border border-border/40 bg-muted/15 p-2">
            {communityPulse.items.map((item) => (
              <li key={`${item.communityId}-${item.title}`}>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      openCommunity(item.communityId)
                    } catch {
                      goTab("communities")
                    }
                  }}
                  className="flex w-full min-h-10 items-start gap-2 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-muted/40"
                >
                  <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-medium text-foreground line-clamp-1">
                      {item.title}
                    </span>
                    <span className="block text-[10px] text-muted-foreground line-clamp-1">
                      {item.communityName}
                      {item.subtitle ? ` · ${item.subtitle}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}


export default HomeCommandCentre
