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
