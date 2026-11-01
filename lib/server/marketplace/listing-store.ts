/**
 * Authoritative marketplace listings (server).
 * Price/seller/currency come from here — never from client order create body.
 * Media, location, category, condition, tags live in `metadata` jsonb (durable).
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
  /** Durable media facade URLs (private-bucket /api/media/.../content) */
  media?: string[]
  location?: string
  category?: string
  condition?: string
  tags?: string[]
  createdAt?: number
  updatedAt?: number
}

function dbConfigured(): boolean {
  const env = readGhcServerEnv()
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey)
}

function sanitizeMedia(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    const s = String(item || "").trim()
    if (!s) continue
    if (s.startsWith("blob:") || s.startsWith("data:")) continue
    if (s.includes("placeholder")) continue
    out.push(s.slice(0, 500))
    if (out.length >= 12) break
  }
  return out
}

function metadataFromInput(input: {
  media?: string[]
  location?: string
  category?: string
  condition?: string
  tags?: string[]
}): Record<string, unknown> {
  const meta: Record<string, unknown> = {}
  const media = sanitizeMedia(input.media)
  if (media.length) meta.media = media
  if (input.location) meta.location = String(input.location).trim().slice(0, 120)
  if (input.category) meta.category = String(input.category).trim().slice(0, 64)
  if (input.condition) meta.condition = String(input.condition).trim().slice(0, 32)
  if (Array.isArray(input.tags) && input.tags.length) {
    meta.tags = input.tags.map((t) => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 12)
  }
  return meta
}

function rowToListing(r: Record<string, unknown>): ServerMarketListing {
  const meta =
    r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
      ? (r.metadata as Record<string, unknown>)
      : r.meta && typeof r.meta === "object" && !Array.isArray(r.meta)
        ? (r.meta as Record<string, unknown>)
        : {}
  const media = sanitizeMedia(meta.media ?? r.media)
  const location =
    meta.location != null
      ? String(meta.location)
      : r.location != null
        ? String(r.location)
        : undefined
  const category =
    meta.category != null
      ? String(meta.category)
      : r.category != null
        ? String(r.category)
        : undefined
  const condition =
    meta.condition != null
      ? String(meta.condition)
      : r.condition != null
        ? String(r.condition)
        : undefined
  const tags = Array.isArray(meta.tags)
    ? meta.tags.map(String).filter(Boolean).slice(0, 12)
    : undefined

  const createdRaw = r.created_at ?? r.createdAt
  const updatedRaw = r.updated_at ?? r.updatedAt
  const createdAt =
    typeof createdRaw === "number"
      ? createdRaw
      : createdRaw
        ? Date.parse(String(createdRaw)) || undefined
        : undefined
  const updatedAt =
    typeof updatedRaw === "number"
      ? updatedRaw
      : updatedRaw
        ? Date.parse(String(updatedRaw)) || undefined
        : undefined

  return {
    id: String(r.id || ""),
    sellerId: String(r.seller_id || r.sellerId || ""),
    title: String(r.title || ""),
    description: r.description != null ? String(r.description) : undefined,
    price: Number(r.price) || 0,
    currency: String(r.currency || "GHC"),
    availability: Number(r.availability) || 0,
    status: (r.status as ServerMarketListing["status"]) || "active",
    kind: r.kind != null ? String(r.kind) : undefined,
    media: media.length ? media : undefined,
    location: location || undefined,
    category: category || undefined,
    condition: condition || undefined,
    tags,
    createdAt,
    updatedAt,
  }
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
  await rpcJson("gh_marketplace_release_expired_reservations", {})
  const data = await rpcJson("gh_marketplace_listing_get", { p_id: key })
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  // RPC may return camelCase or snake; normalize via rowToListing
  return rowToListing({
    ...d,
    seller_id: d.sellerId ?? d.seller_id,
    metadata: d.metadata ?? d.meta,
  })
}

export async function upsertListing(
  input: ServerMarketListing & { sellerId: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!dbConfigured()) {
    return { ok: false, error: "LISTINGS_REQUIRE_DATABASE" }
  }
  const meta = metadataFromInput(input)
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
      metadata: meta,
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

const LISTING_SELECT =
  "id,seller_id,title,description,price,currency,availability,status,kind,metadata,created_at,updated_at"

/** Public catalog: active listings only. */
export async function listActiveListings(limit = 50): Promise<ServerMarketListing[]> {
  if (!dbConfigured()) return []
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return []
  const lim = Math.min(Math.max(limit, 1), 100)
  try {
    await rpcJson("gh_marketplace_release_expired_reservations", {})
    const q = `gh_marketplace_listings?status=eq.active&select=${LISTING_SELECT}&order=updated_at.desc&limit=${lim}`
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
    return rows.map(rowToListing).filter((l) => l.id)
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
    const q = `gh_marketplace_listings?seller_id=eq.${encodeURIComponent(sid)}&status=neq.removed&select=${LISTING_SELECT}&order=updated_at.desc&limit=${lim}`
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
    return rows.map(rowToListing).filter((l) => l.id)
  } catch {
    return []
  }
}

/** Map server listing → domain/UI shape fields */
export function serverListingToClient(l: ServerMarketListing): Record<string, unknown> {
  return {
    id: l.id,
    sellerId: l.sellerId,
    title: l.title,
    description: l.description || "",
    price: l.price,
    currency: l.currency,
    availability: l.availability,
    status: l.status,
    kind: l.kind || "product",
    media: l.media || [],
    location: l.location || "",
    category: l.category || "Goods",
    condition: l.condition || "not_applicable",
    tags: l.tags || [],
    createdAt: l.createdAt || Date.now(),
    updatedAt: l.updatedAt || Date.now(),
  }
}
