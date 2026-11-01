"use client"

/**
 * Long-press / open roster of users who liked, voted, or viewed content.
 * Data is server-authoritative; owner-gated lists may return FORBIDDEN.
 */
import { useEffect, useState } from "react"
import { X, Users } from "lucide-react"
import {
  socialListPostReactions,
  socialListPostVotes,
  socialListPostViewers,
  socialListStoryViewers,
} from "@/lib/social/client"

export type RosterKind = "likes" | "upvotes" | "downvotes" | "viewers" | "story_viewers"

type RosterUser = {
  userId: string
  displayName: string
  avatarUrl?: string
  subtitle?: string
}

interface EngagementRosterSheetProps {
  open: boolean
  onClose: () => void
  kind: RosterKind
  postId?: string
  storyId?: string
  title?: string
}

function kindTitle(kind: RosterKind): string {
  switch (kind) {
    case "likes":
      return "Likes"
    case "upvotes":
      return "Upvotes"
    case "downvotes":
      return "Downvotes"
    case "viewers":
      return "Viewers"
    case "story_viewers":
      return "Story viewers"
    default:
      return "People"
  }
}

export function EngagementRosterSheet({
  open,
  onClose,
  kind,
  postId,
  storyId,
  title,
}: EngagementRosterSheetProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<RosterUser[]>([])
  const [durable, setDurable] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      setUsers([])
      try {
        let res: {
          ok: boolean
          durable: boolean
          users: Array<Record<string, unknown>>
          error?: string
        }
        if (kind === "likes" && postId) {
          res = await socialListPostReactions(postId, "like")
        } else if (kind === "upvotes" && postId) {
          res = await socialListPostVotes(postId, "upvote")
        } else if (kind === "downvotes" && postId) {
          res = await socialListPostVotes(postId, "downvote")
        } else if (kind === "viewers" && postId) {
          res = await socialListPostViewers(postId)
        } else if (kind === "story_viewers" && storyId) {
          res = await socialListStoryViewers(storyId)
        } else {
          setError("Missing content id")
          setLoading(false)
          return
        }
        if (cancelled) return
        if (!res.ok) {
          setError(
            res.error === "FORBIDDEN"
              ? "Only the content owner can see this list"
              : res.error || "Could not load list"
          )
          setDurable(Boolean(res.durable))
          setLoading(false)
          return
        }
        setDurable(Boolean(res.durable))
        setUsers(
          res.users.map((u) => ({
            userId: String(u.userId || ""),
            displayName: String(u.displayName || "Member"),
            avatarUrl: u.avatarUrl ? String(u.avatarUrl) : undefined,
            subtitle:
              u.choice
                ? String(u.choice)
                : u.reaction
                  ? String(u.reaction)
                  : u.lastViewedAt || u.viewedAt
                    ? "Viewed"
                    : undefined,
          })).filter((u) => u.userId)
        )
      } catch {
        if (!cancelled) setError("Network error")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, kind, postId, storyId])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title || kindTitle(kind)}
      onClick={onClose}
    >
      <div
        className="flex max-h-[70vh] w-full max-w-md flex-col rounded-t-2xl bg-background shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-bold text-foreground">{title || kindTitle(kind)}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">{error}</p>
          ) : users.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {durable ? "No one here yet" : "List unavailable until server sync is ready"}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {users.map((u) => (
                <li
                  key={u.userId}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/60"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={u.avatarUrl || "/placeholder.svg?width=40&height=40"}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover bg-muted"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{u.displayName}</p>
                    {u.subtitle ? (
                      <p className="truncate text-[11px] text-muted-foreground">{u.subtitle}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
