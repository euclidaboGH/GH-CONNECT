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
      `gh_marketplace_listings?status=eq.active&select=id,seller_id,title,description,price,currency,availability,status,kind&order=updated_at.desc&limit=${lim}`
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
      `gh_marketplace_listings?seller_id=eq.${encodeURIComponent(sid)}&status=neq.removed&select=id,seller_id,title,description,price,currency,availability,status,kind&order=updated_at.desc&limit=${lim}`
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
    }))
  } catch {
    return []
  }
}

