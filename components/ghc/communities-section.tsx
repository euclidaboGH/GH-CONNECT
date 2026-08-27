"use client"

import { Users } from "lucide-react"

const COMMUNITIES = ["Tech Enthusiasts", "Travel Lovers", "Foodies", "Fitness Buddies", "Art & Design"] as const

export function CommunitiesSection({ onViewCommunity }: { onViewCommunity: (name: string) => void }) {
  return (
    <section className="rounded-2xl bg-white px-4 py-5" aria-labelledby="communities-heading">
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-5 w-5 text-[#7C3AED]" aria-hidden="true" />
        <h2 id="communities-heading" className="text-lg font-bold text-black">Communities</h2>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Communities">
        {COMMUNITIES.map((community) => (
          <button
            key={community}
            type="button"
            onClick={() => onViewCommunity(community)}
            className="shrink-0 rounded-full border border-purple-200 bg-purple-50 px-3 py-2 text-sm font-semibold text-[#7C3AED] transition hover:bg-purple-100 active:scale-95"
          >
            {community}
          </button>
        ))}
      </div>
    </section>
  )
}
