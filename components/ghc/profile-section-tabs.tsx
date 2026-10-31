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
      className="gh-profile-nav sticky top-0 z-[2] mt-3 flex w-full gap-0.5 overflow-x-auto border-y border-border/50 bg-background/95 px-2 py-1.5 backdrop-blur-md"
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
            onClick={() => onChange(tab.id)}
            className={
              selected
                ? "shrink-0 rounded-full bg-emerald-600 px-3.5 py-2 text-[12px] font-bold text-white shadow-sm transition"
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
