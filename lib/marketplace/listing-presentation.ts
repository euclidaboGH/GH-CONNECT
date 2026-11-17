/**
 * Pure listing presentation helpers (Phase 4 split from marketplace-screen).
 */
import type { MarketplaceListing } from "@/lib/domains/marketplace-domain"

export function kindLabel(kind: MarketplaceListing["kind"]): string {
  if (kind === "service") return "Service"
  if (kind === "opportunity") return "Opportunity"
  return "Product"
}

export function statusChip(status: MarketplaceListing["status"]): {
  label: string
  className: string
} {
  if (status === "active")
    return { label: "Available", className: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" }
  if (status === "sold_out")
    return { label: "Sold out", className: "bg-amber-500/15 text-amber-800 dark:text-amber-200" }
  if (status === "paused")
    return { label: "Paused", className: "bg-muted text-muted-foreground" }
  return { label: status, className: "bg-muted text-muted-foreground" }
}
