"use client"

/**
 * Home top — greeting + daily reward + command-centre foundation sections.
 * Creating content is handled by the bottom navigation Create (+) button.
 * Production never injects demo people/communities into these cards.
 */

import { useMemo } from "react"
import { useGHCProfile, useGHCMessaging, useGHCFeed } from "@/contexts/ghc-context"
import { listMyCommunitiesForHome } from "@/lib/domains/adapters/my-communities-home"
import { buildHomeCommunityPulse } from "@/lib/domains/adapters/home-community-pulse"
import { Calendar } from "lucide-react"
import { listInvitationsForViewer } from "@/lib/domains/adapters/community-invites-adapter"
import { CommunityInviteCard } from "./community-invite-card"
import { IdentityService } from "@/lib/identity/identity-service"
import { useGHC } from "@/contexts/ghc-context"
import { DailyRewardHomeExperience } from "./daily-reward-experience"
import {
  createIdentitySeam,
  createConnectionsSeam,
  createMessagingSeam,
  createFeedSeam,
} from "@/lib/domains/adapters/ghc-context-seams"
import { isDemoDataAllowed } from "@/lib/demo-data-policy"
import { Users, MessagesSquare, Compass, ArrowRight, Sparkles } from "lucide-react"
import { resolveHomeNextAction } from "@/lib/domains/adapters/home-next-action"
// community home strip

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
  try {
    // Shell listens for "ghc:navigate-tab" with string detail (app.tsx).
    // Also emit legacy "ghc:navigate" with { tab } for older listeners.
    window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: tab }))
    window.dispatchEvent(new CustomEvent("ghc:navigate", { detail: { tab } }))
  } catch {
    /* */
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
  const myCommunities = listMyCommunitiesForHome(
    (ghcSession.conversations || []) as any[],
    meId,
    { blockedUserIds: ghcSession.blockedUsers || [], limit: 6 }
  )
  const invites = listInvitationsForViewer(
    (ghcSession.conversations || []) as any[],
    meId,
    { blockedUserIds: ghcSession.blockedUsers || [] }
  ).filter((i: { status: string }) => i.status === "invited")

  const communityPulse = buildHomeCommunityPulse({
    viewerId: meId || "",
    conversations: (ghcSession.conversations || []) as any[],
    blockedUserIds: ghcSession.blockedUsers || [],
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

  return (
    <section className="space-y-2.5" aria-label="Home command centre">
      <header className="flex items-center gap-2.5 px-0.5">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-emerald-100 ring-2 ring-emerald-200/70 dark:bg-emerald-950 dark:ring-emerald-800">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xs font-bold text-emerald-800 dark:text-emerald-200">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold tracking-tight text-foreground">
            {greet}, {name}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            Social · Communities · Value
            {completion !== null ? ` · profile ${completion}%` : ""}
          </p>
        </div>
      </header>

      {/* One clear next step — progressive disclosure (not a feature dump) */}
      <button
        type="button"
        onClick={() => {
          if (nextAction.event) {
            try {
              window.dispatchEvent(new CustomEvent(nextAction.event, { detail: {} }))
            } catch {
              /* */
            }
            return
          }
          if (nextAction.target !== "home") goTab(nextAction.target)
        }}
        className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition active:scale-[0.99] ${
          nextAction.urgency === "high"
            ? "border-emerald-300/90 bg-gradient-to-r from-emerald-50 to-teal-50/80 dark:border-emerald-800 dark:from-emerald-950/60 dark:to-teal-950/40"
            : "border-border/60 bg-card/80 hover:border-emerald-200 dark:hover:border-emerald-800"
        }`}
        aria-label={`${nextAction.title}. ${nextAction.cta}`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-bold text-foreground">{nextAction.title}</span>
          <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
            {nextAction.body}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
          {nextAction.cta}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      </button>

      <DailyRewardHomeExperience />

      {/* Social layer shortcuts — flat IA, ≤2 taps from home */}
      <div className="grid grid-cols-3 gap-1.5" role="region" aria-label="Social shortcuts">
        <MiniCard
          title="People"
          body={networkBody}
          action="Discover"
          onAction={() => goTab("discover")}
          icon={Users}
        />
        <MiniCard
          title="Messages"
          body={messagesBody}
          action="Open"
          onAction={() => goTab("messages")}
          icon={MessagesSquare}
        />
        <MiniCard
          title="Communities"
          body={
            myCommunities.length > 0
              ? `${myCommunities.length} joined · board & chat`
              : "Join a group to belong"
          }
          action={myCommunities.length > 0 ? "Open" : "Explore"}
          onAction={() => goTab("communities")}
          icon={Compass}
        />
      </div>

      {invites.length > 0 ? (
        <div className="space-y-2" aria-label="Community invitations">
          <h3 className="px-0.5 text-[12px] font-bold text-foreground">Community invitations</h3>
          {invites.slice(0, 3).map((inv) => (
            <CommunityInviteCard
              key={inv.communityId}
              invite={inv}
              onAccept={async () =>
                ghcSession.acceptCommunityInvitation
                  ? ghcSession.acceptCommunityInvitation(inv.communityId)
                  : false
              }
              onDecline={async () =>
                ghcSession.declineCommunityInvitation
                  ? ghcSession.declineCommunityInvitation(inv.communityId)
                  : false
              }
              onOpen={() => {
                try {
                  window.dispatchEvent(
                    new CustomEvent("ghc:open-community", {
                      detail: { groupId: inv.communityId },
                    })
                  )
                } catch {
                  goTab("discover")
                }
              }}
            />
          ))}
        </div>
      ) : null}


      {communityPulse.hasSignal && communityPulse.items.some((i) => i.kind === "event") ? (
        <div className="space-y-1.5" aria-label="From your communities">
          <h3 className="px-0.5 text-[12px] font-bold text-foreground">Happening in your communities</h3>
          <ul className="space-y-1.5">
            {communityPulse.items
              .filter((i) => i.kind === "event")
              .map((item) => (
                <li key={`${item.communityId}-${item.title}`}>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        window.dispatchEvent(
                          new CustomEvent("ghc:open-community", {
                            detail: { groupId: item.communityId, tab: "events" },
                          })
                        )
                      } catch {
                        goTab("communities")
                      }
                    }}
                    className="flex w-full min-h-12 items-center gap-2.5 rounded-2xl border border-border/70 bg-card px-2.5 py-2 text-left transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">
                      <Calendar className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-foreground">
                        {item.title}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {item.subtitle}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2" aria-label="My communities">
        <div className="flex items-center justify-between px-0.5">
          <h3 className="text-[12px] font-bold text-foreground">My communities</h3>
          <button
            type="button"
            onClick={() => goTab("communities")}
            className="text-[11px] font-semibold text-teal-700 dark:text-teal-300"
          >
            See all
          </button>
        </div>
        {myCommunities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-3 py-4">
            <p className="text-sm font-semibold text-foreground">You haven’t joined a community yet.</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Belong with people who share your interests.
            </p>
            <button
              type="button"
              onClick={() => goTab("communities")}
              className="mt-2 min-h-10 rounded-xl bg-teal-600 px-3 text-xs font-bold text-white"
            >
              Discover communities
            </button>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {myCommunities.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      window.dispatchEvent(
                        new CustomEvent("ghc:open-community", { detail: { groupId: c.id } })
                      )
                    } catch {
                      goTab("discover")
                    }
                  }}
                  className="flex w-full min-h-12 items-center gap-2.5 rounded-2xl border border-border/70 bg-card px-2.5 py-2 text-left transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-100 text-xs font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                    {c.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.coverImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (c.name || "C").slice(0, 1)
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-foreground">{c.name}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {c.description || c.category || c.membershipState || "Member"}
                    </span>
                  </span>
                  <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300">Open</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default HomeCommandCentre
