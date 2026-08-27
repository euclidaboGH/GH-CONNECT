"use client"

/**
 * GH Connect empty-state design system.
 * Use across Feed, Messages, Communities, Discover, Matches, Profile.
 */

import type { ReactNode } from "react"
import {
  MessageCircle,
  Users,
  Newspaper,
  Compass,
  Heart,
  Inbox,
  Search,
  type LucideIcon,
} from "lucide-react"

export type EmptyVariant =
  | "feed"
  | "messages"
  | "communities"
  | "discover"
  | "matches"
  | "search"
  | "generic"

const PRESETS: Record<
  EmptyVariant,
  { icon: LucideIcon; title: string; description: string; gradient: string }
> = {
  feed: {
    icon: Newspaper,
    title: "Your feed is quiet",
    description: "Follow people or share your first post to see activity here.",
    gradient: "from-emerald-500 to-teal-500",
  },
  messages: {
    icon: MessageCircle,
    title: "No conversations yet",
    description:
      "Message matches and connections here. Requests stay separate until you accept.",
    gradient: "from-emerald-500 to-cyan-600",
  },
  communities: {
    icon: Users,
    title: "Find your next circle",
    description: "Join a community for posts and events, or create one for people like you.",
    gradient: "from-teal-500 to-emerald-600",
  },
  discover: {
    icon: Compass,
    title: "No people to show yet",
    description:
      "Adjust filters, add interests, or set your location for better recommendations.",
    gradient: "from-emerald-600 to-teal-500",
  },
  matches: {
    icon: Heart,
    title: "No matches yet",
    description:
      "Express interest on Find. A match means mutual intentional interest — not automatic friendship.",
    gradient: "from-rose-500 to-emerald-600",
  },
  search: {
    icon: Search,
    title: "No results",
    description: "Try another name, interest, or community keyword.",
    gradient: "from-stone-500 to-stone-600",
  },
  generic: {
    icon: Inbox,
    title: "Nothing here",
    description: "Check back later or try another section.",
    gradient: "from-emerald-400 to-teal-600",
  },
}

export function EmptyState({
  variant = "generic",
  title,
  description,
  icon: IconOverride,
  action,
  secondaryAction,
  className = "",
}: {
  variant?: EmptyVariant
  title?: string
  description?: string
  icon?: LucideIcon
  action?: { label: string; onClick: () => void }
  secondaryAction?: { label: string; onClick: () => void }
  className?: string
}) {
  const preset = PRESETS[variant]
  const Icon = IconOverride || preset.icon

  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}
      role="status"
    >
      <div
        className={`relative mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[1.35rem] bg-gradient-to-br ${preset.gradient} text-white shadow-lg shadow-emerald-500/20 ring-4 ring-primary/10 dark:shadow-none`}
      >
        <Icon size={30} strokeWidth={2} aria-hidden />
      </div>
      <h3 className="text-[17px] font-bold tracking-tight text-foreground">
        {title || preset.title}
      </h3>
      <p className="mt-2 max-w-[17rem] text-[13px] leading-relaxed text-muted-foreground">
        {description || preset.description}
      </p>
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 transition hover:opacity-95 active:scale-[0.97]"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="rounded-full border border-border bg-card px-6 py-2.5 text-sm font-bold text-foreground transition hover:bg-muted active:scale-[0.97]"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Compact inline empty used inside cards / lists */
export function EmptyInline({
  message,
  actionLabel,
  onAction,
}: {
  message: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/30 px-4 py-8 text-center">
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 text-sm font-bold text-primary hover:opacity-90"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

/** Optional wrapper when a tab needs a short tip under the header */
export function SectionTip({ children }: { children: ReactNode }) {
  return (
    <p className="mx-4 mb-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
      {children}
    </p>
  )
}
