"use client"

/**
 * First-session guidance — shown once after onboarding (or until dismissed).
 * Helps new users take meaningful first actions without cluttering permanent UI.
 */

import { useEffect, useState } from "react"
import { Compass, Users, MessageCircle, UserRound, X, Sparkles } from "lucide-react"

const STORAGE_KEY = "ghc-first-session-tips-v1"

export function FirstSessionTips({
  onNavigate,
}: {
  onNavigate?: (tab: "discover" | "communities" | "messages" | "profile") => void
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      const dismissed = window.localStorage.getItem(STORAGE_KEY)
      if (!dismissed) setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [])

  const dismiss = () => {
    setVisible(false)
    try {
      window.localStorage.setItem(STORAGE_KEY, "1")
    } catch {
      /* ignore */
    }
  }

  if (!visible) return null

  const tips = [
    {
      id: "discover" as const,
      icon: Compass,
      title: "Find people",
      body: "Follow or connect with people who share your interests.",
    },
    {
      id: "communities" as const,
      icon: Users,
      title: "Join a community",
      body: "Belong to groups for discussion, events, and member chat.",
    },
    {
      id: "messages" as const,
      icon: MessageCircle,
      title: "Start a chat",
      body: "Message matches and connections when you’re ready.",
    },
    {
      id: "profile" as const,
      icon: UserRound,
      title: "Finish your profile",
      body: "Photo, bio, and interests help others recognize you.",
    },
  ]

  return (
    <div
      className="mx-3 mb-3 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-teal-50/50 p-3.5 shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/50 dark:via-card dark:to-teal-950/30"
      role="region"
      aria-label="Getting started tips"
    >
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Sparkles size={16} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-bold text-foreground">Welcome to GH Connect</p>
            <p className="text-[11px] text-muted-foreground">Follow 3 · Join 1 community · Share 1 post</p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          aria-label="Dismiss tips"
        >
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {tips.map(({ id, icon: Icon, title, body }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              onNavigate?.(id)
              dismiss()
            }}
            className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-card/90 px-3 py-2.5 text-left transition hover:border-emerald-300 hover:bg-emerald-50/50 active:scale-[0.99] dark:hover:bg-emerald-950/30"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              <Icon size={16} aria-hidden />
            </span>
            <span>
              <span className="block text-[12px] font-bold text-foreground">{title}</span>
              <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">{body}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
