"use client"

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
import { DailyRewardHomeExperience } from "./daily-reward-experience"
import { CommunityInviteCard } from "@/components/ghc/community-invite-card"
import {
  createIdentitySeam,
  createConnectionsSeam,
  createMessagingSeam,
  createFeedSeam,
} from "@/lib/domains/adapters/ghc-context-seams"
import { isDemoDataAllowed } from "@/lib/demo-data-policy"
import { Users, MessagesSquare, Compass, ArrowRight, Sparkles } from "lucide-react"
import { resolveHomeNextAction } from "@/lib/domains/adapters/home-next-action"
import { navigateTo, openCommunity } from "@/lib/navigation/navigate"

function timeGreeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 5) return "Good night"
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  if (h < 21) return "Good evening"
  return "Good night"
}

function firstName(displayName?: string | null): string {
  const n = (displayName || "").trim()
  if (!n) return "there"
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

  const greet = useMemo(() => timeGreeting(), [])
  const name = firstName(profile?.displayName)
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
  const nextAction = resolveHomeNextAction({
    profileCompletionPercent: completion,
    messagesNeedingAttention: attentionCount,
    myCommunitiesCount: myCommunities.length,
    friendsOrFollowingCount: friendsOrFollowing,
    hasDisplayName: Boolean(profile?.displayName?.trim()),
    hasPhoto: Boolean(avatar),
  })

  // Feed-first: only high-signal chrome. Discover/Ecosystem/People live in their destinations.
  const showNextStep =
    nextAction.urgency === "high" ||
    (completion !== null && completion < 100)

  return (
    <section className="space-y-2" aria-label="Home command centre">
      <header className="flex items-center gap-2.5 px-0.5 pb-0.5">
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-emerald-100 ring-1 ring-emerald-200/60 dark:bg-emerald-950 dark:ring-emerald-800">
          {avatar ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[11px] font-bold text-emerald-800 dark:text-emerald-200">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold tracking-tight text-foreground">
            {greet}, {name}
          </p>
          {completion !== null && completion < 100 ? (
            <p className="truncate text-[11px] text-muted-foreground">
              Profile {completion}% complete
            </p>
          ) : null}
        </div>
      </header>

      {showNextStep ? (
        <button
          type="button"
          onClick={() => {
            if (nextAction.event) {
              try {
                if (nextAction.event === "ghc:open-wallet") {
                  navigateTo("wallet")
                  return
                }
                window.dispatchEvent(new CustomEvent(nextAction.event, { detail: {} }))
              } catch {
                /* */
              }
              return
            }
            if (nextAction.target !== "home") goTab(nextAction.target)
          }}
          className="flex w-full items-center gap-2.5 rounded-xl border border-border/50 bg-muted/30 px-2.5 py-2 text-left transition active:scale-[0.99] hover:bg-muted/50"
          aria-label={`${nextAction.title}. ${nextAction.cta}`}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-semibold text-foreground">
              {nextAction.title}
            </span>
            <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground line-clamp-1">
              {nextAction.body}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            {nextAction.cta}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </button>
      ) : null}

      <DailyRewardHomeExperience />

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
                      <img src={c.coverImage} alt="" className="h-full w-full object-cover" />
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
              Discover groups that match your interests
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
