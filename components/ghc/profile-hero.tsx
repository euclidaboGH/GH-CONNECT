"use client"

/**
 * Profile hierarchy — social-platform first.
 * Photo → Name → @handle → GH-ID → Location → Bio → Edit/Share → Stats → GreenHaven Identity
 */

import { useCallback, useMemo, useState } from "react"
import { Copy, Check, MapPin, Pencil, Share2, BadgeCheck } from "lucide-react"
import {
  getOrCreateGreenHavenId,
  formatGreenHavenIdDisplay,
} from "@/lib/domains/greenhaven-id"
import { GreenHavenIdentityCard } from "./greenhaven-identity-card"
import { SignatureGhIdCard } from "./signature-gh-id"
import { ExpandableBio } from "./profile-components"

function toHandle(displayName: string, username?: string | null): string {
  if (username && username.trim()) {
    const u = username.trim().replace(/^@/, "")
    return `@${u}`
  }
  const base = (displayName || "member")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 24)
  return `@${base || "member"}`
}

export function ProfileHeroMeta({
  displayName,
  username,
  userId,
  preferredId,
  city,
  country,
  bio,
  verified,
  postsCount,
  friendsCount,
  followingCount,
  onEdit,
  onShare,
  onToast,
  onSendGhc,
  onOpenWallet,
}: {
  displayName: string
  username?: string | null
  userId: string
  preferredId?: string | null
  city?: string | null
  country?: string | null
  bio?: string | null
  verified?: boolean
  postsCount: number
  friendsCount: number
  followingCount: number
  onEdit: () => void
  onShare: () => void
  onToast?: (msg: string, type: "success" | "error" | "info") => void
  onSendGhc?: (ghId: string) => void
  onOpenWallet?: () => void
}) {
  const ghId = useMemo(
    () => getOrCreateGreenHavenId(userId, preferredId),
    [userId, preferredId]
  )
  const ghDisplay = formatGreenHavenIdDisplay(ghId)
  const handle = toHandle(displayName, username)
  const locationLine = [city, country].filter(Boolean).join(", ")
  const [copied, setCopied] = useState(false)

  const copyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ghDisplay)
      setCopied(true)
      onToast?.("GreenHaven ID copied", "success")
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      onToast?.("Could not copy", "error")
    }
  }, [ghDisplay, onToast])

  return (
    <div className="min-w-0 flex-1 space-y-3 pt-1">
      {/* Name + verification */}
      <div>
        <h1 className="flex flex-wrap items-center gap-1.5 text-[1.35rem] font-black tracking-tight text-foreground sm:text-2xl">
          <span className="truncate">{displayName || "Member"}</span>
          {verified ? (
            <BadgeCheck size={18} className="shrink-0 text-sky-600" aria-label="Verified" />
          ) : null}
        </h1>
        <p className="mt-0.5 text-[13px] font-semibold text-muted-foreground">{handle}</p>
        <p className="mt-0.5 font-mono text-[12px] font-bold tracking-wide text-emerald-800 dark:text-emerald-300">
          {ghDisplay}
        </p>
        {locationLine ? (
          <p className="mt-1 flex items-center gap-1 text-[12px] font-medium text-muted-foreground">
            <MapPin size={13} className="shrink-0 text-emerald-600" aria-hidden />
            <span className="truncate">{locationLine}</span>
          </p>
        ) : null}
      </div>

      {/* Bio */}
      <ExpandableBio
        bio={
          bio?.trim() ||
          "Add a short bio so people know what makes you unique."
        }
      />

      {/* Primary actions */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald-700 px-4 text-[13px] font-bold text-white shadow-sm transition hover:bg-emerald-800 sm:flex-none"
        >
          <Pencil size={14} aria-hidden />
          Edit Profile
        </button>
        <button
          type="button"
          onClick={onShare}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 text-[13px] font-bold text-foreground transition hover:bg-muted sm:flex-none"
        >
          <Share2 size={14} aria-hidden />
          Share
        </button>
      </div>

      {/* Compact stats */}
      <div
        className="flex items-center justify-between gap-1 rounded-xl border border-border/70 bg-muted/40 px-2 py-2.5"
        role="group"
        aria-label="Profile stats"
      >
        <StatCell label="Posts" value={postsCount} />
        <span className="h-6 w-px bg-border" aria-hidden />
        <StatCell label="Friends" value={friendsCount} />
        <span className="h-6 w-px bg-border" aria-hidden />
        <StatCell label="Following" value={followingCount} />
      </div>

      {/* GreenHaven Identity — compact card */}
      <div className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-card dark:border-emerald-900 dark:from-emerald-950/40">
        <div className="flex items-center justify-between gap-2 border-b border-emerald-100/80 px-3 py-2 dark:border-emerald-900/50">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-800 dark:text-emerald-300">
            Social identity · GreenHaven ID
          </p>
          <p className="px-3 text-[10px] text-muted-foreground">Who you are — not what you own</p>
          <button
            type="button"
            onClick={() => void copyId()}
            className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy ID"}
          </button>
        </div>
        <div className="p-2.5 pt-2">
          <SignatureGhIdCard
            userId={userId}
            displayName={displayName}
            preferredId={preferredId}
            verified={verified}
            onToast={onToast}
          />
        </div>
      </div>
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1">
      <span className="text-[15px] font-black tabular-nums text-foreground">{value}</span>
      <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
    </div>
  )
}
