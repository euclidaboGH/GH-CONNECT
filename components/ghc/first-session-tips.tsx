"use client"

/**
 * First-session guidance — progressive disclosure after onboarding.
 * One activation path: profile → community → message (not a 12-step tour).
 *
 * Research: first meaningful outcome under ~60s; max 3 primary tips;
 * dismissible; modeless (does not block feed).
 */

import { useEffect, useState } from "react"
import { Compass, Users, UserRound, X, Sparkles } from "lucide-react"

const STORAGE_KEY = "ghc-first-session-tips-v2"

export function FirstSessionTips({
  onNavigate,
}: {
  onNavigate?: (tab: "discover" | "communities" | "messages" | "profile") => void
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      // Prefer v2 key; also honor prior dismiss so we don't re-nag
      const dismissed =
        window.localStorage.getItem(STORAGE_KEY) ||
        window.localStorage.getItem("ghc-first-session-tips-v1")
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

  // Three layers only — Identity · Social · Belonging
  const tips = [
    {
      id: "profile" as const,
      icon: UserRound,
      title: "1 · Identity",
      body: "Photo + bio so people know who you are.",
    },
    {
      id: "communities" as const,
      icon: Users,
      title: "2 · Belong",
      body: "Join one community — board, events, member chat.",
    },
    {
      id: "discover" as const,
      icon: Compass,
      title: "3 · Connect",
      body: "Find people by interests and goals.",
    },
  ]

  return (
    <div
      className="mx-3 mb-3 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-teal-50/50 p-3.5 shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/50 dark:via-card dark:to-teal-950/30"
      role="region"
      aria-label="Getting started"
    >
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Sparkles size={16} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-bold text-foreground">Your first 3 steps</p>
            <p className="text-[11px] text-muted-foreground">
              Identity · Community · People — then explore freely
            </p>
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
              <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                {body}
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 px-0.5 text-[10px] text-muted-foreground">
        Wallet & rewards live under Profile → Value when you need them.
      </p>
    </div>
  )
}
