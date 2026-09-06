"use client"

/**
 * Community invitation card — Accept/Decline via authoritative context actions.
 */

import { useState } from "react"
import { Users, Check, X } from "lucide-react"
import type { CommunityInvitationView } from "@/lib/domains/adapters/community-invites-adapter"

export function CommunityInviteCard({
  invite,
  onAccept,
  onDecline,
  onOpen,
}: {
  invite: CommunityInvitationView
  onAccept: () => Promise<boolean>
  onDecline: () => Promise<boolean>
  onOpen?: () => void
}) {
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null)
  const [done, setDone] = useState<"accepted" | "declined" | null>(null)

  const accept = async () => {
    if (busy || done) return
    setBusy("accept")
    try {
      const ok = await onAccept()
      if (ok) setDone("accepted")
    } finally {
      setBusy(null)
    }
  }

  const decline = async () => {
    if (busy || done) return
    setBusy("decline")
    try {
      const ok = await onDecline()
      if (ok) setDone("declined")
    } finally {
      setBusy(null)
    }
  }

  if (done === "declined") {
    return (
      <article className="rounded-2xl border border-border/60 bg-muted/40 p-3 text-[12px] text-muted-foreground">
        Invitation to {invite.communityName} declined.
      </article>
    )
  }

  if (done === "accepted" || invite.status === "member") {
    return (
      <article className="rounded-2xl border border-teal-200 bg-teal-50/80 p-3 dark:border-teal-900/40 dark:bg-teal-950/30">
        <p className="text-sm font-semibold text-foreground">You’re a member of {invite.communityName}</p>
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="mt-2 min-h-10 rounded-xl bg-teal-600 px-3 text-xs font-bold text-white"
          >
            Open community
          </button>
        ) : null}
      </article>
    )
  }

  if (invite.status === "pending_request") {
    return (
      <article className="rounded-2xl border border-border bg-card p-3">
        <p className="text-sm font-semibold text-foreground">{invite.communityName}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">Join request pending approval</p>
      </article>
    )
  }

  if (invite.status !== "invited") {
    return (
      <article className="rounded-2xl border border-border bg-card p-3 text-[12px] text-muted-foreground">
        This invitation is no longer available.
      </article>
    )
  }

  return (
    <article
      className="rounded-2xl border border-border bg-card p-3 shadow-sm"
      aria-label={`Invitation to ${invite.communityName}`}
    >
      <div className="flex gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-100 dark:bg-emerald-950">
          {invite.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={invite.coverImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <Users size={20} className="text-emerald-800 dark:text-emerald-200" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">{invite.communityName}</h3>
          {invite.purpose ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{invite.purpose}</p>
          ) : (
            <p className="mt-0.5 text-[11px] text-muted-foreground">You’ve been invited to join</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => void accept()}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-600 text-sm font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <Check size={16} aria-hidden />
          {busy === "accept" ? "Joining…" : "Accept"}
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => void decline()}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-sm font-bold text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <X size={16} aria-hidden />
          {busy === "decline" ? "…" : "Decline"}
        </button>
      </div>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="mt-2 w-full min-h-10 text-[11px] font-semibold text-teal-700 dark:text-teal-300"
        >
          View community
        </button>
      ) : null}
    </article>
  )
}

export default CommunityInviteCard
