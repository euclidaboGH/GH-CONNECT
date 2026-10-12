/**
 * Authoritative marketplace listings (server).
 * Price/seller/currency come from here — never from client order create body.
 */
import { readGhcServerEnv } from "@/lib/server/economy/env"

export type ServerMarketListing = {
  id: string
  sellerId: string
  title: string
  description?: string
  price: number
  currency: string
  availability: number
  status: "draft" | "active" | "paused" | "sold_out" | "removed"
  kind?: string
  metadata?: Record<string, unknown>
}

function dbConfigured(): boolean {
  const env = readGhcServerEnv()
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey)
}

async function rpcJson(fn: string, body: Record<string, unknown>): Promise<unknown | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const res = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    const text = await res.text()
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  } catch {
    return null
  }
}

export async function getListing(id: string): Promise<ServerMarketListing | null> {
  const key = String(id || "").trim()
  if (!key) return null
  if (!dbConfigured()) return null
  const data = await rpcJson("gh_marketplace_listing_get", { p_id: key })
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  return {
    id: String(d.id || ""),
    sellerId: String(d.sellerId || ""),
    title: String(d.title || ""),
    description: d.description != null ? String(d.description) : undefined,
    price: Number(d.price) || 0,
    currency: String(d.currency || "GHC"),
    availability: Number(d.availability) || 0,
    status: (d.status as ServerMarketListing["status"]) || "active",
    kind: d.kind != null ? String(d.kind) : undefined,
    metadata: d.metadata && typeof d.metadata === "object" && !Array.isArray(d.metadata) ? d.metadata as Record<string, unknown> : {},
  }
}

export async function upsertListing(
  input: ServerMarketListing & { sellerId: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!dbConfigured()) {
    return { ok: false, error: "LISTINGS_REQUIRE_DATABASE" }
  }
  const res = await rpcJson("gh_marketplace_listing_upsert", {
    p_row: {
      id: input.id,
      sellerId: input.sellerId,
      title: input.title,
      description: input.description || "",
      price: input.price,
      currency: input.currency,
      availability: input.availability,
      status: input.status,
      kind: input.kind || "product",
      metadata: input.metadata || {},
    },
  })
  if (!res || typeof res !== "object") return { ok: false, error: "UPSERT_FAILED" }
  if ((res as { ok?: boolean }).ok === false) {
    return { ok: false, error: String((res as { error?: string }).error || "UPSERT_FAILED") }
  }
  return { ok: true }
}

export function listingsDurable(): boolean {
  return dbConfigured()
}

/** Public catalog: active listings only. */
export async function listActiveListings(limit = 50): Promise<ServerMarketListing[]> {
  if (!dbConfigured()) return []
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return []
  const lim = Math.min(Math.max(limit, 1), 100)
  try {
    const q =
      `gh_marketplace_listings?status=eq.active&select=id,seller_id,title,description,price,currency,availability,status,kind,metadata&order=updated_at.desc&limit=${lim}`
    const res = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/${q}`, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      cache: "no-store",
    })
    if (!res.ok) return []
    const rows = (await res.json()) as Array<Record<string, unknown>>
    if (!Array.isArray(rows)) return []
    return rows.map((r) => ({
      id: String(r.id || ""),
      sellerId: String(r.seller_id || ""),
      title: String(r.title || ""),
      description: r.description != null ? String(r.description) : undefined,
      price: Number(r.price) || 0,
      currency: String(r.currency || "GHC"),
      availability: Number(r.availability) || 0,
      status: (r.status as ServerMarketListing["status"]) || "active",
      kind: r.kind != null ? String(r.kind) : undefined,
      metadata: r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata) ? r.metadata as Record<string, unknown> : {},
    }))
  } catch {
    return []
  }
}

/** Seller's own listings (any status except removed). */
export async function listSellerListings(
  sellerId: string,
  limit = 50
): Promise<ServerMarketListing[]> {
  const sid = String(sellerId || "").trim()
  if (!sid || !dbConfigured()) return []
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return []
  const lim = Math.min(Math.max(limit, 1), 100)
  try {
    const q =
      `gh_marketplace_listings?seller_id=eq.${encodeURIComponent(sid)}&status=neq.removed&select=id,seller_id,title,description,price,currency,availability,status,kind,metadata&order=updated_at.desc&limit=${lim}`
    const res = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/${q}`, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      cache: "no-store",
    })
    if (!res.ok) return []
    const rows = (await res.json()) as Array<Record<string, unknown>>
    if (!Array.isArray(rows)) return []
    return rows.map((r) => ({
      id: String(r.id || ""),
      sellerId: String(r.seller_id || ""),
      title: String(r.title || ""),
      description: r.description != null ? String(r.description) : undefined,
      price: Number(r.price) || 0,
      currency: String(r.currency || "GHC"),
      availability: Number(r.availability) || 0,
      status: (r.status as ServerMarketListing["status"]) || "active",
      kind: r.kind != null ? String(r.kind) : undefined,
      metadata: r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata) ? r.metadata as Record<string, unknown> : {},
    }))
  } catch {
    return []
  }
}


/** Reserve stock in the database under a row lock; environment flags are not proof of atomicity. */
export async function reserveListingStock(input: {
  listingId: string
  orderId: string
  buyerId: string
  quantity: number
  ttlSeconds?: number
}): Promise<{ ok: true; duplicate?: boolean; expiresAt?: string; remaining?: number } | { ok: false; error: string; available?: number }> {
  if (!dbConfigured()) return { ok: false, error: "STOCK_RESERVATION_DATABASE_REQUIRED" }
  const raw = await rpcJson("gh_marketplace_stock_reserve", {
    p_listing_id: input.listingId,
    p_order_id: input.orderId,
    p_buyer_id: input.buyerId,
    p_quantity: input.quantity,
    p_ttl_seconds: input.ttlSeconds ?? 900,
  })
  if (!raw || typeof raw !== "object") return { ok: false, error: "STOCK_RESERVATION_RPC_UNAVAILABLE" }
  const data = raw as Record<string, unknown>
  if (data.ok !== true) return {
    ok: false,
    error: String(data.error || "STOCK_RESERVATION_FAILED"),
    available: Number.isFinite(Number(data.available)) ? Number(data.available) : undefined,
  }
  return {
    ok: true,
    duplicate: Boolean(data.duplicate),
    expiresAt: data.expiresAt == null ? undefined : String(data.expiresAt),
    remaining: Number.isFinite(Number(data.remaining)) ? Number(data.remaining) : undefined,
  }
}

export async function commitListingStock(orderId: string): Promise<{ ok: boolean; error?: string }> {
  if (!dbConfigured()) return { ok: false, error: "STOCK_RESERVATION_DATABASE_REQUIRED" }
  const raw = await rpcJson("gh_marketplace_stock_commit", { p_order_id: orderId })
  if (!raw || typeof raw !== "object" || (raw as { ok?: boolean }).ok !== true) {
    return { ok: false, error: String((raw as { error?: string } | null)?.error || "STOCK_COMMIT_FAILED") }
  }
  return { ok: true }
}

export async function releaseListingStock(orderId: string): Promise<{ ok: boolean; error?: string }> {
  if (!dbConfigured()) return { ok: false, error: "STOCK_RESERVATION_DATABASE_REQUIRED" }
  const raw = await rpcJson("gh_marketplace_stock_release", { p_order_id: orderId, p_final_status: "released" })
  if (!raw || typeof raw !== "object" || (raw as { ok?: boolean }).ok !== true) {
    return { ok: false, error: String((raw as { error?: string } | null)?.error || "STOCK_RELEASE_FAILED") }
  }
  return { ok: true }
}

export async function validateListingStockReservation(orderId: string): Promise<{ ok: boolean; error?: string }> {
  if (!dbConfigured()) return { ok: false, error: "STOCK_RESERVATION_DATABASE_REQUIRED" }
  const raw = await rpcJson("gh_marketplace_stock_validate", { p_order_id: orderId })
  if (!raw || typeof raw !== "object" || (raw as { ok?: boolean }).ok !== true) {
    return { ok: false, error: String((raw as { error?: string } | null)?.error || "STOCK_RESERVATION_INVALID") }
  }
  return { ok: true }
}
