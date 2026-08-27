"use client"

/**
 * Profile / first-session setup checklist — progressive, dismissible.
 * Goals: photo, bio, location, interests, follow 3, join 1 community, first post.
 */

import { useMemo, useState, useEffect } from "react"
import { Check, Circle, X } from "lucide-react"
import { useGHC } from "@/contexts/ghc-context"

const DISMISS_KEY = "ghc-setup-checklist-dismissed-v1"

export function SetupChecklist({
  onNavigate,
  compact = false,
}: {
  onNavigate?: (tab: string) => void
  compact?: boolean
}) {
  const { profile, following, posts, conversations } = useGHC()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1")
    } catch {
      setDismissed(false)
    }
  }, [])

  const items = useMemo(() => {
    const hasPhoto =
      Array.isArray(profile?.photos) &&
      profile.photos.some((p) => typeof p === "string" && p && !p.includes("placeholder"))
    const hasBio = Boolean(profile?.bio && String(profile.bio).trim().length >= 12)
    const hasLocation = Boolean(
      (profile?.city && profile.city.trim()) || (profile?.country && profile.country.trim())
    )
    const hasInterests = Array.isArray(profile?.interests) && profile.interests.length >= 1
    const follows = (following || []).length >= 3
    const communities = (conversations || []).filter(
      (c: { conversationType?: string }) => c.conversationType === "group" || c.conversationType === "community"
    ).length >= 1
    const posted = (posts || []).some(
      (p: { authorId?: string }) => p.authorId === "current-user" || !p.authorId
    )
    return [
      { id: "photo", label: "Add a profile photo", done: hasPhoto, tab: "profile" },
      { id: "bio", label: "Write a short bio", done: hasBio, tab: "profile" },
      { id: "location", label: "Set your location", done: hasLocation, tab: "profile" },
      { id: "interests", label: "Add interests", done: hasInterests, tab: "profile" },
      { id: "follow", label: "Follow 3 people", done: follows, tab: "discover" },
      { id: "community", label: "Join 1 community", done: communities, tab: "communities" },
      { id: "post", label: "Share your first post", done: posted, tab: "home" },
    ]
  }, [profile, following, posts, conversations])

  const doneCount = items.filter((i) => i.done).length
  const allDone = doneCount === items.length

  if (dismissed || allDone) return null

  return (
    <div
      className={`rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30 ${compact ? "" : "mx-3 mb-3"}`}
      role="region"
      aria-label="Setup checklist"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-foreground">You’re getting set</p>
          <p className="text-[11px] text-muted-foreground">
            {doneCount}/{items.length} complete — small steps, better connections
          </p>
        </div>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          aria-label="Dismiss checklist"
          onClick={() => {
            setDismissed(true)
            try {
              window.localStorage.setItem(DISMISS_KEY, "1")
            } catch {
              /* */
            }
          }}
        >
          <X size={16} />
        </button>
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => {
                if (!item.done) {
                  onNavigate?.(item.tab)
                  window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: item.tab }))
                }
              }}
              className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-background/80"
            >
              {item.done ? (
                <Check size={16} className="shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <Circle size={16} className="shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span
                className={`text-[13px] font-medium ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}
              >
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
