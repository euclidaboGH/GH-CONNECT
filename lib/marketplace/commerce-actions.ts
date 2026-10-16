/**
 * Marketplace ↔ chat ↔ pay wiring helpers.
 * Does not invent payments — only navigation and conversation entry points.
 */

import { navigateTo, openChat } from "@/lib/navigation/navigate"

export type ListingRef = {
  listingId?: string | null
  sellerId?: string | null
  sellerName?: string | null
  sellerPhoto?: string | null
  title?: string | null
}

/** Open marketplace surface focused on a listing (ecosystem until dedicated tab exists). */
export function openListing(listingId: string) {
  const id = String(listingId || "").trim()
  if (!id) return
  navigateTo("marketplace", { listingId: id })
}

/**
 * Message the seller about a listing (buyer → seller DM).
 * Prefills navigation only; compose UI may read ghc:compose-prefill if present.
 */
export function messageListingSeller(listing: ListingRef) {
  const sellerId = String(listing.sellerId || "").trim()
  if (!sellerId) {
    openListing(String(listing.listingId || ""))
    return
  }
  const title = listing.title ? String(listing.title) : "your listing"
  try {
    window.dispatchEvent(
      new CustomEvent("ghc:compose-prefill", {
        detail: {
          text: `Hi — I'm interested in “${title}” on GreenHaven Marketplace.`,
          listingId: listing.listingId,
        },
      }),
    )
  } catch {
    /* */
  }
  openChat(sellerId, listing.sellerName || undefined, listing.sellerPhoto || undefined)
}

/** Pay path: open GH Pay / wallet after user confirms intent (no auto-charge). */
export function openPayForListing(listing: ListingRef, rail: "pi" | "ghc" = "pi") {
  if (rail === "ghc") {
    navigateTo("wallet")
    try {
      window.dispatchEvent(
        new CustomEvent("ghc:wallet-focus", {
          detail: { purpose: "marketplace", listingId: listing.listingId },
        }),
      )
    } catch {
      /* */
    }
    return
  }
  navigateTo("marketplace", { listingId: listing.listingId || undefined })
  try {
    window.dispatchEvent(
      new CustomEvent("ghc:open-gh-pay", {
        detail: { listingId: listing.listingId, purpose: "marketplace" },
      }),
    )
  } catch {
    /* */
  }
}
