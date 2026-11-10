import type { MarketplaceListing } from "@/lib/domains/marketplace-domain"
import { getMarketplaceDomain, getCommunityDomain } from "@/lib/domains/compat"

function formatCurrencyAmount(amount: number, currency: string): string {
  if (!Number.isFinite(amount) || amount < 0) return "—"
  const cur = (currency || "GHC").trim().toUpperCase()
  const formatted = amount.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (cur === "GHC") return `₲ ${formatted}`
  if (cur === "PI" || cur === "Π") return `${formatted} π`
  return `${formatted} ${cur || "GHC"}`
}

export function formatPrice(listing: MarketplaceListing): string {
  const variants = (listing.variants || []).filter((variant) => variant.active !== false && (variant.available ?? variant.stockOnHand) > 0 && Number.isFinite(variant.price) && variant.price >= 0)
  if (variants.length) {
    const prices = variants.map((variant) => variant.price)
    const minimum = Math.min(...prices)
    const maximum = Math.max(...prices)
    const formatted = formatCurrencyAmount(minimum, variants[0].currency)
    return maximum > minimum ? `From ${formatted}` : formatted
  }
  const amount = Number(listing.price)
  return formatCurrencyAmount(amount, listing.currency || "GHC")
}

export function listedWhen(ts?: number): string {
  if (!ts || !Number.isFinite(ts)) return ""
  const normalizedTs = ts < 100_000_000_000 ? ts * 1000 : ts
  const days = Math.floor((Date.now() - normalizedTs) / 86400000)
  if (days < 0) return "Recently listed"
  if (days < 1) return "Listed today"
  if (days === 1) return "Listed yesterday"
  if (days < 14) return `Listed ${days} days ago`
  if (days < 60) return `Listed ${Math.floor(days / 7)} weeks ago`
  return `Listed ${new Date(normalizedTs).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
}


/** Build related search chips from real listing text — never invent products. */
export function relatedSearchTokens(listing: MarketplaceListing): string[] {
  const stop = new Set(
    "a an the and or for with from this that available location each eachs is are in on of to".split(" "),
  )
  const raw = `${listing.title} ${listing.category || ""} ${(listing.tags || []).join(" ")} ${listing.description || ""}`
  const words = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s+-]/gi, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !stop.has(w) && !/^\d+$/.test(w))
  const seen = new Set<string>()
  const out: string[] = []
  for (const w of words) {
    if (seen.has(w)) continue
    seen.add(w)
    out.push(w)
    if (out.length >= 8) break
  }
  if (listing.category && !seen.has(listing.category.toLowerCase())) {
    out.unshift(listing.category)
  }
  return out.slice(0, 6)
}

export function relatedListingsFor(listing: MarketplaceListing, limit = 6): MarketplaceListing[] {
  const domain = getMarketplaceDomain()
  if (!domain?.listListings) return []
  const safeLimit = Math.max(0, Math.min(12, Math.floor(Number.isFinite(limit) ? limit : 6)))
  if (!safeLimit) return []
  const all = domain.listListings({ status: "active" }) || []
  const cat = (listing.category || "").toLowerCase()
  const tokens = new Set(relatedSearchTokens(listing).map((t) => t.toLowerCase()))
  const scored = all
    .filter((l) => l.id !== listing.id && l.status === "active")
    .map((l) => {
      let score = 0
      if (cat && (l.category || "").toLowerCase() === cat) score += 5
      const hay = `${l.title} ${l.category} ${(l.tags || []).join(" ")}`.toLowerCase()
      for (const t of tokens) {
        if (hay.split(/[^a-z0-9]+/).includes(t)) score += 1
      }
      return { l, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.l.id.localeCompare(b.l.id))
  return scored.slice(0, safeLimit).map((x) => x.l)
}

export type CommunitySuggest = { id: string; name: string; memberCount?: number; photo?: string }

export function suggestedCommunitiesFor(listing: MarketplaceListing, limit = 5): CommunitySuggest[] {
  try {
    const safeLimit = Math.max(0, Math.min(10, Math.floor(Number.isFinite(limit) ? limit : 5)))
    if (!safeLimit) return []
    const domain = getCommunityDomain()
    if (!domain?.listCommunities) return []
    const list = domain.listCommunities() || []
    const tokens = relatedSearchTokens(listing).map((t) => t.toLowerCase())
    const cat = (listing.category || "").toLowerCase()
    const scored = list.map((c: {
      id: string
      name?: string
      groupName?: string
      members?: string[]
      memberIds?: string[]
      groupPhoto?: string
      participantPhoto?: string
    }) => {
      const name = (c.name || c.groupName || "").trim()
      const hay = name.toLowerCase()
      let score = 0
      if (cat && hay.includes(cat)) score += 4
      for (const t of tokens) {
        if (hay.includes(t)) score += 2
      }
      const memberCount = Array.isArray(c.members)
        ? c.members.length
        : Array.isArray(c.memberIds)
          ? c.memberIds.length
          : undefined
      return {
        id: c.id,
        name: name || "Community",
        memberCount,
        photo: c.groupPhoto || c.participantPhoto,
        score,
      }
    })
    return scored
      .filter((x) => x.score > 0 && x.id)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, safeLimit)
      .map(({ id, name, memberCount, photo }) => ({ id, name, memberCount, photo }))
  } catch {
    return []
  }
}

