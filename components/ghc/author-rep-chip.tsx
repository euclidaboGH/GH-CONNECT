"use client"

/**
 * Phase 10 — show author reputation only when post/profile already carries data.
 */

import { formatReputationChip, type ReputationDisplayInput } from "@/lib/reputation/display"

export function AuthorRepChip({
  data,
  className = "",
}: {
  data: ReputationDisplayInput | null | undefined
  className?: string
}) {
  if (!data) return null
  const label = formatReputationChip(data)
  if (!label) return null
  return (
    <span
      className={`inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 ${className}`}
      title="Reputation from verified activity — not for sale"
    >
      {label}
    </span>
  )
}
