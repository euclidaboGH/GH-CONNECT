/**
 * Server-only GHC database access.
 * Privileged credentials never leave this module to the client.
 */

import { readGhcServerEnv, hasPrivilegedDatabase, type GhcServerEnv } from "./env"
import type { GhcTransferResult } from "@/lib/domains/economy-transfer-contract"
import { mapTransferFailure } from "@/lib/domains/economy-transfer-contract"
import type { GhcTransaction } from "@/lib/domains/economy-types"

export type RpcTransferInput = {
  senderId: string
  toUserId: string
  amount: number
  referenceId: string
  note?: string
  requestId?: string
}

function mapRpcJson(data: unknown): GhcTransferResult {
  const row = data as Record<string, unknown>
  if (!row || typeof row !== "object") {
    return { ok: false, error: mapTransferFailure("Empty RPC response") }
  }
  if (row.ok === false) {
    return {
      ok: false,
      error: mapTransferFailure(String(row.message || row.code || "TRANSFER_FAILED"), String(row.code || "TRANSFER_FAILED") as any),
    }
  }
  const debitTx = (row.debitTx || row.debit) as GhcTransaction | undefined
  const creditTx = (row.creditTx || row.credit) as GhcTransaction | undefined
  if (!debitTx || !creditTx) {
    return { ok: false, error: mapTransferFailure("Invalid RPC transfer payload") }
  }
  // Normalize numeric amounts if returned as strings from Postgres
  const norm = (tx: GhcTransaction): GhcTransaction => ({
    ...tx,
    amount: Number(tx.amount),
    createdAt: Number(tx.createdAt) || Date.now(),
    userId: String(tx.userId),
    kind: tx.kind,
    status: tx.status,
    reason: tx.reason || "",
    sourceEvent: tx.sourceEvent || "WALLET_TRANSFER",
    referenceId: tx.referenceId || String(row.referenceId || ""),
  })
  return {
    ok: true,
    idempotent: Boolean(row.idempotent),
    referenceId: String(row.referenceId || debitTx.referenceId),
    debitTx: norm(debitTx),
    creditTx: norm(creditTx),
  }
}

/**
 * Call public.ghc_execute_transfer via Supabase REST RPC (service role).
 * This is the production path when SUPABASE_URL + SERVICE_ROLE_KEY are set.
 */
export async function rpcExecuteTransfer(
  input: RpcTransferInput,
  env: GhcServerEnv = readGhcServerEnv()
): Promise<GhcTransferResult> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return {
      ok: false,
      error: mapTransferFailure(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for RPC",
        "SERVER_UNAVAILABLE"
      ),
    }
  }

  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_execute_transfer`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        p_sender_id: input.senderId,
        p_to_user_id: input.toUserId,
        p_amount: input.amount,
        p_reference_id: input.referenceId,
        p_note: input.note ?? null,
        p_request_id: input.requestId ?? null,
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      // Never forward raw SQL / internal text to clients in production mapping
      return {
        ok: false,
        error: mapTransferFailure(
          res.status >= 500 ? "SERVER_UNAVAILABLE" : text || `HTTP ${res.status}`,
          res.status >= 500 ? "SERVER_UNAVAILABLE" : "TRANSFER_FAILED"
        ),
      }
    }

    const data = await res.json()
    // Supabase may return the jsonb value directly or nested
    const payload = Array.isArray(data) ? data[0] : data
    return mapRpcJson(payload)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network"
    return {
      ok: false,
      error: mapTransferFailure(msg, "SERVER_UNAVAILABLE"),
    }
  }
}

export async function rpcListTransactions(
  userId: string,
  env: GhcServerEnv = readGhcServerEnv()
): Promise<GhcTransaction[] | null> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  const url =
    `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/ghc_transactions` +
    `?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=500`
  try {
    const res = await fetch(url, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
    })
    if (!res.ok) return null
    const rows = (await res.json()) as Array<Record<string, unknown>>
    return rows.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      kind: r.kind as GhcTransaction["kind"],
      amount: Number(r.amount),
      status: r.status as GhcTransaction["status"],
      reason: String(r.reason || ""),
      sourceEvent: String(r.source_event || ""),
      referenceId: r.reference_id != null ? String(r.reference_id) : undefined,
      createdAt: r.created_at ? new Date(String(r.created_at)).getTime() : Date.now(),
      postedAt: r.posted_at ? new Date(String(r.posted_at)).getTime() : undefined,
      metadata: (r.metadata as GhcTransaction["metadata"]) || undefined,
    }))
  } catch {
    return null
  }
}

export async function rpcFindTransferByReference(
  referenceId: string,
  env: GhcServerEnv = readGhcServerEnv()
): Promise<{ debit?: GhcTransaction; credit?: GhcTransaction } | null> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  const url =
    `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/ghc_transactions` +
    `?reference_id=eq.${encodeURIComponent(referenceId)}&status=eq.posted` +
    `&kind=in.(transfer_out,transfer_in)`
  try {
    const res = await fetch(url, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
    })
    if (!res.ok) return null
    const rows = (await res.json()) as Array<Record<string, unknown>>
    const mapped = rows.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      kind: r.kind as GhcTransaction["kind"],
      amount: Number(r.amount),
      status: r.status as GhcTransaction["status"],
      reason: String(r.reason || ""),
      sourceEvent: String(r.source_event || ""),
      referenceId: String(r.reference_id || ""),
      createdAt: r.created_at ? new Date(String(r.created_at)).getTime() : Date.now(),
    }))
    return {
      debit: mapped.find((t) => t.kind === "transfer_out"),
      credit: mapped.find((t) => t.kind === "transfer_in"),
    }
  } catch {
    return null
  }
}

export { hasPrivilegedDatabase }

/** --- D6.2 transfer-request RPCs --- */

async function rpcJson(
  fn: string,
  body: Record<string, unknown>,
  env: GhcServerEnv = readGhcServerEnv()
): Promise<Record<string, unknown> | null> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${fn}`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function rpcCreateTransferRequest(input: {
  requesterId: string
  payerId: string
  amount: number
  referenceId: string
  note?: string
}): Promise<Record<string, unknown> | null> {
  return rpcJson("ghc_create_transfer_request", {
    p_requester_id: input.requesterId,
    p_payer_id: input.payerId,
    p_amount: input.amount,
    p_reference_id: input.referenceId,
    p_note: input.note ?? null,
  })
}

export async function rpcAcceptTransferRequest(input: {
  actorId: string
  referenceId: string
}): Promise<Record<string, unknown> | null> {
  return rpcJson("ghc_accept_transfer_request", {
    p_actor_id: input.actorId,
    p_reference_id: input.referenceId,
  })
}

export async function rpcDeclineTransferRequest(input: {
  actorId: string
  referenceId: string
}): Promise<Record<string, unknown> | null> {
  return rpcJson("ghc_decline_transfer_request", {
    p_actor_id: input.actorId,
    p_reference_id: input.referenceId,
  })
}

export async function rpcCancelTransferRequest(input: {
  actorId: string
  referenceId: string
}): Promise<Record<string, unknown> | null> {
  return rpcJson("ghc_cancel_transfer_request", {
    p_actor_id: input.actorId,
    p_reference_id: input.referenceId,
  })
}

export async function rpcListTransferRequests(
  userId: string,
  direction: "incoming" | "outgoing" | "all" = "all",
  env: GhcServerEnv = readGhcServerEnv()
): Promise<Array<Record<string, unknown>> | null> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  const base = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/ghc_transfer_requests`
  const params = new URLSearchParams()
  params.set("order", "created_at.desc")
  params.set("limit", "100")
  if (direction === "incoming") {
    params.set("payer_id", `eq.${userId}`)
  } else if (direction === "outgoing") {
    params.set("requester_id", `eq.${userId}`)
  } else {
    params.set("or", `(payer_id.eq.${userId},requester_id.eq.${userId})`)
  }
  try {
    const res = await fetch(`${base}?${params}`, {
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
    })
    if (!res.ok) return null
    return (await res.json()) as Array<Record<string, unknown>>
  } catch {
    return null
  }
}

/** Ensure immutable account_created_at for membership trial */
export async function rpcEnsureAccountCreatedAt(
  userId: string,
  hintMs?: number,
  env: GhcServerEnv = readGhcServerEnv()
): Promise<{ ok: boolean; accountCreatedAt?: number; created?: boolean; error?: string }> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_ensure_account_created_at`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_hint: hintMs != null ? new Date(hintMs).toISOString() : null,
      }),
    })
    if (!res.ok) {
      return { ok: false, error: "SERVER_UNAVAILABLE" }
    }
    const data = (await res.json()) as Record<string, unknown>
    if (data && data.ok === false) return { ok: false, error: String(data.error || "FAILED") }
    return {
      ok: true,
      accountCreatedAt: Number(data.accountCreatedAt),
      created: Boolean(data.created),
    }
  } catch {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
}

/** Server-authoritative claim of pending GHC */
export async function rpcClaimPending(
  userId: string,
  holdId: string,
  env: GhcServerEnv = readGhcServerEnv()
): Promise<{
  ok: boolean
  alreadyClaimed?: boolean
  transactionId?: string
  amount?: number
  error?: string
}> {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/ghc_claim_pending`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({ p_user_id: userId, p_hold_id: holdId }),
    })
    if (!res.ok) {
      return { ok: false, error: "SERVER_UNAVAILABLE" }
    }
    const data = (await res.json()) as Record<string, unknown>
    if (!data || data.ok === false) {
      return { ok: false, error: String(data?.error || "NOT_CLAIMABLE") }
    }
    return {
      ok: true,
      alreadyClaimed: Boolean(data.alreadyClaimed),
      transactionId: data.transactionId != null ? String(data.transactionId) : undefined,
      amount: data.amount != null ? Number(data.amount) : undefined,
    }
  } catch {
    return { ok: false, error: "SERVER_UNAVAILABLE" }
  }
}
