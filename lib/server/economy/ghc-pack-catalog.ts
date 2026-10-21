/**
 * Phase 3 — Governed Pi-funded GHC pack catalog.
 * Fixed product terms only — not a live FX rate.
 * Server is sole authority for π amount and GHC credit.
 */

export type GhcPackProduct = {
  productId: string
  ghcAmount: number
  piAmount: number
  label: string
  /** Soft marketing copy */
  blurb: string
}

/** Authoritative catalog — keep in sync with GH Pay products. */
export const GHC_PACK_CATALOG: Record<string, GhcPackProduct> = {
  ghc_pack_10: {
    productId: "ghc_pack_10",
    ghcAmount: 10,
    piAmount: 0.5,
    label: "Starter 10 GHC",
    blurb: "Try utility spends and small transfers",
  },
  ghc_pack_50: {
    productId: "ghc_pack_50",
    ghcAmount: 50,
    piAmount: 2,
    label: "Builder 50 GHC",
    blurb: "Boosts and community tools",
  },
  ghc_pack_100: {
    productId: "ghc_pack_100",
    ghcAmount: 100,
    piAmount: 3.5,
    label: "Creator 100 GHC",
    blurb: "Creator tools and feed spotlight",
  },
  ghc_pack_250: {
    productId: "ghc_pack_250",
    ghcAmount: 250,
    piAmount: 8,
    label: "Pro 250 GHC",
    blurb: "Membership top-ups and heavy utility",
  },
  ghc_pack_500: {
    productId: "ghc_pack_500",
    ghcAmount: 500,
    piAmount: 15,
    label: "Studio 500 GHC",
    blurb: "High-volume creators and operators",
  },
}

/** Per-user acquisition limits (anti-abuse). Override via env. */
export function packPurchaseLimits() {
  const day = Number(process.env.GHC_PACK_MAX_PER_DAY || 5)
  const week = Number(process.env.GHC_PACK_MAX_PER_WEEK || 15)
  const ghcDay = Number(process.env.GHC_PACK_MAX_GHC_PER_DAY || 1000)
  return {
    maxPurchasesPerDay: Number.isFinite(day) && day > 0 ? Math.floor(day) : 5,
    maxPurchasesPerWeek: Number.isFinite(week) && week > 0 ? Math.floor(week) : 15,
    maxGhcCreditedPerDay: Number.isFinite(ghcDay) && ghcDay > 0 ? ghcDay : 1000,
  }
}

export function getGhcPack(productId: string): GhcPackProduct | null {
  const id = String(productId || "").trim()
  return GHC_PACK_CATALOG[id] || null
}

export function listGhcPacks(): GhcPackProduct[] {
  return Object.values(GHC_PACK_CATALOG)
}

export function isGhcPackProductId(productId: string): boolean {
  return Boolean(getGhcPack(productId))
}

/** Lagos day key for caps (align with claim engine timezone). */
export function lagosDayKey(d = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}
