"use client"
/**
 * Phase 2A — marketplace browse section boundary.
 * Economic totals must come from server quotes, not client multiplication alone.
 */
import type { ReactNode } from "react"

export function MarketplaceBrowseSection({ children }: { children: ReactNode }) {
  return <section aria-label="Marketplace browse">{children}</section>
}
