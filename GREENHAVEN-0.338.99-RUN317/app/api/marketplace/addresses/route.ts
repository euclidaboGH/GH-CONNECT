/**
 * Saved delivery addresses — authenticated owner only (Marketplace Phase 3).
 * Backed by service-role-only RPCs from a held proposal (supabase/proposals). Until an operator
 * applies that proposal this route fails closed with 503; it never falls back to client storage.
 * Personal data: responses are no-store and nothing here is logged.
 */
import { NextResponse } from "next/server"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { enforceUserMutationRateLimit } from "@/lib/server/security/user-rate-limit"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { addressErrorResponse, buildSavePayload, isAddressId, parseSavedAddresses, readAddressFields } from "@/lib/marketplace/saved-addresses"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }
type RpcResult = Record<string, unknown> | null

async function rpc(name: string, body: Record<string, unknown>): Promise<{ ok: boolean; data: RpcResult }> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false, data: null }
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST",
      signal: AbortSignal.timeout(8_000),
      headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify(body), cache: "no-store",
    })
    const data = await response.json().catch(() => null) as RpcResult
    return { ok: response.ok && Boolean(data), data }
  } catch { return { ok: false, data: null } }
}

const unavailable = () => NextResponse.json({ ok: false, error: "MARKETPLACE_ADDRESSES_UNAVAILABLE" }, { status: 503, headers: NO_STORE })

function failure(result: { ok: boolean; data: RpcResult }) {
  if (!result.ok) return unavailable()
  // Only whitelisted codes are returned; raw RPC/PostgREST error text is never reflected to the client.
  const { status, error } = addressErrorResponse(result.data?.error)
  return NextResponse.json({ ok: false, error }, { status, headers: NO_STORE })
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const rateLimited = await enforceUserMutationRateLimit(auth.userId, "marketplace/addresses:GET", 60, 60_000, { failClosed: true })
  if (rateLimited) return rateLimited
  const result = await rpc("gh_marketplace_address_list", { p_user_id: auth.userId })
  if (!result.ok || result.data?.ok === false) return unavailable()
  return NextResponse.json({ ok: true, durable: true, addresses: parseSavedAddresses(result.data?.addresses) }, { headers: NO_STORE })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const rateLimited = await enforceUserMutationRateLimit(auth.userId, "marketplace/addresses:POST", 20, 60_000, { failClosed: true })
  if (rateLimited) return rateLimited
  const parsedBody = await readBoundedJson(request, 8 * 1024)
  if (!parsedBody.ok) return NextResponse.json({ ok: false, error: parsedBody.error }, { status: parsedBody.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: NO_STORE })
  const body = parsedBody.value

  // Set-default only: no address fields required.
  if (body.action === "set_default") {
    const id = typeof body.id === "string" ? body.id : ""
    if (!isAddressId(id)) return NextResponse.json({ ok: false, error: "INVALID_ADDRESS_ID" }, { status: 400, headers: NO_STORE })
    const result = await rpc("gh_marketplace_address_set_default", { p_user_id: auth.userId, p_address_id: id })
    if (!result.ok || result.data?.ok === false) return failure(result)
    return NextResponse.json({ ok: true, durable: true, id }, { headers: NO_STORE })
  }

  const read = readAddressFields(body)
  if (!read.ok) return NextResponse.json({ ok: false, error: "INVALID_ADDRESS", issues: read.invalid }, { status: 400, headers: NO_STORE })
  if (body.id != null && body.id !== "" && typeof body.id !== "string") return NextResponse.json({ ok: false, error: "INVALID_ADDRESS_ID" }, { status: 400, headers: NO_STORE })
  const built = buildSavePayload(
    read.fields,
    { id: body.id == null || body.id === "" ? null : (body.id as string), makeDefault: body.makeDefault === true },
  )
  if (!built.ok) return NextResponse.json({ ok: false, error: "INVALID_ADDRESS", issues: built.issues }, { status: 400, headers: NO_STORE })
  const p = built.payload
  const result = await rpc("gh_marketplace_address_save", {
    p_user_id: auth.userId, p_address_id: p.id, p_label: p.label, p_full_name: p.fullName, p_line1: p.line1, p_line2: p.line2,
    p_city: p.city, p_region: p.region, p_postal_code: p.postalCode, p_country: p.country, p_phone: p.phone, p_make_default: p.makeDefault,
  })
  if (!result.ok || result.data?.ok === false) return failure(result)
  return NextResponse.json({ ok: true, durable: true, id: result.data?.id ?? null }, { headers: NO_STORE })
}

export async function DELETE(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: NO_STORE })
  const rateLimited = await enforceUserMutationRateLimit(auth.userId, "marketplace/addresses:DELETE", 20, 60_000, { failClosed: true })
  if (rateLimited) return rateLimited
  const id = new URL(request.url).searchParams.get("id") || ""
  if (!isAddressId(id)) return NextResponse.json({ ok: false, error: "INVALID_ADDRESS_ID" }, { status: 400, headers: NO_STORE })
  const result = await rpc("gh_marketplace_address_delete", { p_user_id: auth.userId, p_address_id: id })
  if (!result.ok || result.data?.ok === false) return failure(result)
  return NextResponse.json({ ok: true, durable: true, id }, { headers: NO_STORE })
}
