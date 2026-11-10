"use client"

/**
 * X-style profile section tabs under the hero.
 * Posts · Media · Listings · Communities · About
 */

export type ProfileSectionTab =
  | "posts"
  | "media"
  | "listings"
  | "communities"
  | "about"

const TABS: { id: ProfileSectionTab; label: string }[] = [
  { id: "posts", label: "Posts" },
  { id: "media", label: "Media" },
  { id: "listings", label: "Listings" },
  { id: "communities", label: "Communities" },
  { id: "about", label: "About" },
]

export function ProfileSectionTabs({
  active,
  onChange,
  counts,
}: {
  active: ProfileSectionTab
  onChange: (tab: ProfileSectionTab) => void
  counts?: Partial<Record<ProfileSectionTab, number>>
}) {
  return (
    <nav
      className="gh-profile-nav sticky top-0 z-[2] mt-3 flex w-full gap-1 overflow-x-auto border-y border-border/40 bg-background/95 px-2 py-2 backdrop-blur-md scrollbar-hide"
      aria-label="Profile sections"
      role="tablist"
    >
      {TABS.map((tab) => {
        const selected = active === tab.id
        const count = counts?.[tab.id]
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`gh-profile-panel-${tab.id}`}
            id={`gh-profile-tab-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            data-profile-tab={tab.id}
            onKeyDown={(event) => {
              const current = TABS.findIndex((item) => item.id === tab.id)
              let next = current
              if (event.key === "ArrowRight") next = (current + 1) % TABS.length
              else if (event.key === "ArrowLeft") next = (current - 1 + TABS.length) % TABS.length
              else if (event.key === "Home") next = 0
              else if (event.key === "End") next = TABS.length - 1
              else return
              event.preventDefault()
              const nextTab = TABS[next]
              onChange(nextTab.id)
              const target = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-profile-tab="${nextTab.id}"]`)
              target?.focus()
            }}
            onClick={() => onChange(tab.id)}
            className={
              selected
                ? "shrink-0 rounded-full bg-emerald-600 px-3.5 py-2 text-[12px] font-bold text-white shadow-sm shadow-emerald-600/25 transition"
                : "shrink-0 rounded-full px-3.5 py-2 text-[12px] font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            }
          >
            {tab.label}
            {typeof count === "number" && count > 0 ? (
              <span className={selected ? "ml-1 opacity-90" : "ml-1 text-muted-foreground"}>
                {count > 99 ? "99+" : count}
              </span>
            ) : null}
          </button>
        )
      })}
    </nav>
  )
}
