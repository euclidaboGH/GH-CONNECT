"use client"

/**
 * Progressive identity layer for Profile — badges + expandable trust strip.
 * Does not expose private wallet balances. Trust ≠ GHC balance.
 */

import { useMemo, useState, type ReactNode } from "react"
import { Award, BadgeCheck, Briefcase, ChevronDown, ChevronUp, Shield, Sparkles, Star, Store } from "lucide-react"
import { getBoundDomainServices } from "@/lib/domains/compat"

export function ProfileTrustStrip({ profileVerified }: { profileVerified?: boolean }) {
  const [expanded, setExpanded] = useState(false)

  const identity = useMemo(() => {
    try {
      const s = getBoundDomainServices()
      const membership = s?.membership?.getStatus?.()
      const plan = s?.membership?.getPlan?.()
      const ver = s?.verification?.getSnapshot?.()
      const labels = s?.verification?.getLabels?.() || []
      const rep = s?.reputation?.getSnapshot?.()
      const achievements = s?.achievements?.getUnlockedForProfile?.() || []
      const seller = s?.marketplace?.getSellerProfile?.("current-user")
      return {
        tier: membership?.tier || "free",
        tierLabel: plan?.label || (membership?.tier === "vvip" ? "VVIP" : membership?.tier === "vip" ? "VIP" : "Member"),
        verified: Boolean(ver?.anyVerified || profileVerified),
        labels: labels as string[],
        repScore: rep?.score,
        repTier: rep?.tier,
        achievements: achievements.slice(0, 6) as { id: string; title?: string; name?: string }[],
        seller:
          seller && (seller.activeListings > 0 || seller.completedOrders > 0)
            ? seller
            : null,
        isCreator: Boolean(s?.verification?.isVerified?.("creator")),
        isBusiness: Boolean(
          s?.verification?.isVerified?.("business") ||
            s?.verification?.isVerified?.("organization")
        ),
        isCommunityLeader: Boolean(
          s?.verification?.isVerified?.("community_leader") ||
            (s?.community as { isLeader?: () => boolean } | undefined)?.isLeader?.()
        ),
      }
    } catch {
      return {
        tier: "free",
        tierLabel: "Member",
        verified: Boolean(profileVerified),
        labels: [] as string[],
        repScore: undefined as number | undefined,
        repTier: undefined as string | undefined,
        achievements: [] as { id: string; title?: string; name?: string }[],
        seller: null as null | {
          activeListings: number
          completedOrders: number
          averageRating: number
        },
        isCreator: false,
        isBusiness: false,
        isCommunityLeader: false,
      }
    }
  }, [profileVerified])

  const primaryBadges: { key: string; label: string; className: string; icon: ReactNode }[] = []
  if (identity.verified) {
    primaryBadges.push({
      key: "verified",
      label: identity.labels[0] || "Verified",
      className: "bg-sky-50 text-sky-800 border-sky-100",
      icon: <BadgeCheck size={12} />,
    })
  }
  if (identity.tier === "vip" || identity.tier === "vvip") {
    primaryBadges.push({
      key: "premium",
      label: identity.tierLabel,
      className:
        identity.tier === "vvip"
          ? "bg-amber-50 text-amber-900 border-amber-100"
          : "bg-violet-50 text-violet-800 border-violet-100",
      icon: <Sparkles size={12} />,
    })
  }
  if (identity.isCreator) {
    primaryBadges.push({
      key: "creator",
      label: "Creator",
      className: "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-100",
      icon: <Star size={12} />,
    })
  }
  if (identity.isBusiness) {
    primaryBadges.push({
      key: "business",
      label: "Business",
      className: "bg-indigo-50 text-indigo-800 border-indigo-100",
      icon: <Briefcase size={12} />,
    })
  }
  if (identity.seller) {
    primaryBadges.push({
      key: "seller",
      label: "Seller",
      className: "bg-emerald-50 text-emerald-800 border-emerald-100",
      icon: <Store size={12} />,
    })
  }
  if (identity.isCommunityLeader) {
    primaryBadges.push({
      key: "leader",
      label: "Community leader",
      className: "bg-teal-50 text-teal-800 border-teal-100",
      icon: <Award size={12} />,
    })
  }

  return (
    <div className="mt-3 space-y-2">
      {/* Trust: Verified / Reputation / VIP only — never GHC balance */}
      <div className="flex flex-wrap items-center gap-1.5">
        {primaryBadges.length === 0 ? (
          <span className="text-[11px] text-muted-foreground">Build trust with verification and quality activity</span>
        ) : (
          primaryBadges.map((b) => (
            <span
              key={b.key}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${b.className}`}
            >
              {b.icon}
              {b.label}
            </span>
          ))
        )}
        {typeof identity.repScore === "number" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <Shield size={12} />
            Rep {identity.repScore}
          </span>
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted/80"
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              Less <ChevronUp size={12} />
            </>
          ) : (
            <>
              Trust details <ChevronDown size={12} />
            </>
          )}
        </button>
      </div>

      {expanded && (
        <div className="space-y-2 rounded-2xl border border-stone-100 bg-stone-50/80 p-3 animate-in fade-in duration-200">
          {/* Reputation — separate from GHC */}
          <div className="flex items-start gap-2">
            <Shield size={14} className="mt-0.5 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-stone-800">Reputation</p>
              <p className="text-[11px] text-stone-500">
                {typeof identity.repScore === "number"
                  ? `Score ${identity.repScore}${identity.repTier ? ` · ${identity.repTier}` : ""} — based on quality interactions, not purchases.`
                  : "Grows with helpful contributions and reliable marketplace activity."}
              </p>
            </div>
          </div>

          {identity.achievements.length > 0 && (
            <div className="flex items-start gap-2">
              <Award size={14} className="mt-0.5 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-stone-800">Achievements</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {identity.achievements.map((a) => (
                    <span
                      key={a.id}
                      className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-stone-700 ring-1 ring-stone-200"
                    >
                      {a.title || a.name || a.id}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {identity.seller && (
            <div className="flex items-start gap-2">
              <Store size={14} className="mt-0.5 text-emerald-600" />
              <div>
                <p className="text-[11px] font-bold text-stone-800">Marketplace</p>
                <p className="text-[11px] text-stone-500">
                  {identity.seller.activeListings} active · {identity.seller.completedOrders} completed
                  {identity.seller.averageRating > 0
                    ? ` · ${identity.seller.averageRating}★ reviews`
                    : ""}
                </p>
              </div>
            </div>
          )}

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Trust strip shows <strong>Verification · Reputation · VIP</strong> only. GHC wallet balance is never
            shown here — balances stay private. Verification ≠ VIP ≠ Reputation ≠ GHC.
          </p>
        </div>
      )}
    </div>
  )
}

export function ProfileInterestChips({
  interests,
  max = 8,
}: {
  interests: string[]
  max?: number
}) {
  const [showAll, setShowAll] = useState(false)
  if (!interests?.length) return null
  const list = showAll ? interests : interests.slice(0, max)
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">Interests</p>
      <div className="flex flex-wrap gap-2">
        {list.map((i) => (
          <span
            key={i}
            className="inline-flex min-h-8 items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800"
          >
            {i}
          </span>
        ))}
        {interests.length > max && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-600"
          >
            {showAll ? "Less" : `+${interests.length - max}`}
          </button>
        )}
      </div>
    </div>
  )
}


/** Clean public identity hierarchy — never shows GHC balance */
export function ProfileIdentityBlock({
  displayName,
  username,
  greenHavenId,
  locationLine,
  profession,
  ageLabel,
  bio,
  verified,
  children,
}: {
  displayName: string
  username: string
  greenHavenId: string
  locationLine: string
  profession?: string
  ageLabel?: string
  bio?: string
  verified?: boolean
  children?: ReactNode
}) {
  const handle = username.startsWith("@") ? username : `@${username}`
  return (
    <div className="min-w-0 flex-1 pb-1">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="truncate text-[22px] font-bold leading-tight tracking-tight text-foreground">
          {displayName}
        </h1>
        {verified ? (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800">
            <BadgeCheck size={12} aria-hidden /> Verified
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-[13px] font-medium text-muted-foreground">{handle}</p>
      <p className="mt-0.5 font-mono text-[12px] tracking-wide text-emerald-700/90 dark:text-emerald-400/90">
        {greenHavenId}
      </p>
      {(ageLabel || profession) && (
        <p className="mt-1 text-sm font-semibold text-foreground/90">
          {ageLabel || null}
          {ageLabel && profession ? (
            <span className="font-medium text-muted-foreground"> · {profession}</span>
          ) : profession ? (
            <span className="font-medium text-muted-foreground">{profession}</span>
          ) : null}
        </p>
      )}
      {locationLine ? (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{locationLine}</p>
      ) : null}
      {children}
    </div>
  )
}
