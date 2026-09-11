"use client"

/**
 * Profile owner — My Communities grid from authoritative membership rows only.
 * No localStorage authority. No fabricated memberships.
 */

import { listMyCommunitiesForHome } from "@/lib/domains/adapters/my-communities-home"
import type { CommunitySummary } from "@/lib/domains/contracts/communities"

export function ProfileMyCommunities({
  conversations,
  viewerId,
  onOpenCommunity,
}: {
  conversations: unknown[] | undefined
  viewerId: string
  onOpenCommunity?: (communityId: string) => void
}) {
  const items: CommunitySummary[] = listMyCommunitiesForHome(
    Array.isArray(conversations) ? (conversations as any[]) : [],
    viewerId
  )

  return (
    <section className="mt-4 w-full px-4" aria-labelledby="profile-my-communities-heading">
      <div className="flex items-center justify-between gap-2">
        <h2
          id="profile-my-communities-heading"
          className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
        >
          My Communities
        </h2>
        {items.length > 0 ? (
          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
            {items.length}
          </span>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="mt-2 rounded-2xl border border-dashed border-border bg-card px-3 py-6 text-center text-[12px] text-muted-foreground">
          You haven&apos;t joined a community yet.
        </p>
      ) : (
        <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  if (onOpenCommunity) {
                    onOpenCommunity(c.id)
                    return
                  }
                  try {
                    window.dispatchEvent(
                      new CustomEvent("ghc:open-community", {
                        detail: { groupId: c.id },
                      })
                    )
                    window.dispatchEvent(
                      new CustomEvent("ghc:navigate-tab", { detail: "communities" })
                    )
                  } catch {
                    /* */
                  }
                }}
                className="flex w-full min-h-[3.25rem] items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {c.photo || c.cover ? (
                    <img
                      src={c.photo || c.cover}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-muted-foreground">
                      {(c.name || "C").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-foreground">{c.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {c.role && c.role !== "guest" ? (
                      <span className="capitalize">{c.role}</span>
                    ) : (
                      "Member"
                    )}
                    {c.description ? ` · ${c.description.slice(0, 48)}` : ""}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
