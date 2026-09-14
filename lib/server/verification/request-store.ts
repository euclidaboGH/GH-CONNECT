/**
 * Durable verification request queue (server-only).
 *
 * Rules:
 * - Authenticated users may create pending requests only
 * - Submitting a request NEVER grants verified / badge / reputation
 * - Production requires Supabase; memory is local/dev only
 * - Review mutations require privileged review API (not this module's public surface)
 */

import { readGhcServerEnv } from "@/lib/server/economy/env"

export type VerificationRequestType =
  | "identity"
  | "creator"
  | "business"
  | "organization"

export type VerificationRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "revoked"
  | "cancelled"

export type VerificationRequest = {
  id: string
  userId: string
  type: VerificationRequestType
  status: VerificationRequestStatus
  note?: string
  evidenceRefs: string[]
  reviewerId?: string
  reviewNote?: string
  createdAt: number
  updatedAt: number
  reviewedAt?: number
}

const g = globalThis as unknown as {
  __ghVerificationRequests?: Map<string, VerificationRequest>
}

function mem(): Map<string, VerificationRequest> {
  if (!g.__ghVerificationRequests) g.__ghVerificationRequests = new Map()
  return g.__ghVerificationRequests
}

function isProd(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production"
}

function dbConfigured(): boolean {
  const env = readGhcServerEnv()
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey)
}

function now() {
  return Date.now()
}

export function genVerificationRequestId(): string {
  return `vreq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

type Row = {
  id: string
  user_id: string
  type: string
  status: string
  note: string | null
  evidence_refs: unknown
  reviewer_id: string | null
  review_note: string | null
  created_at: string
  updated_at: string
  reviewed_at: string | null
}

function rowToRecord(row: Row): VerificationRequest {
  const refs = Array.isArray(row.evidence_refs)
    ? (row.evidence_refs as unknown[]).map(String)
    : []
  return {
    id: String(row.id),
    userId: String(row.user_id),
    type: row.type as VerificationRequestType,
    status: row.status as VerificationRequestStatus,
    note: row.note || undefined,
    evidenceRefs: refs,
    reviewerId: row.reviewer_id || undefined,
    reviewNote: row.review_note || undefined,
    createdAt: Date.parse(row.created_at) || now(),
    updatedAt: Date.parse(row.updated_at) || now(),
    reviewedAt: row.reviewed_at ? Date.parse(row.reviewed_at) || undefined : undefined,
  }
}

function recordToRow(r: VerificationRequest): Record<string, unknown> {
  return {
    id: r.id,
    user_id: r.userId,
    type: r.type,
    status: r.status,
    note: r.note ?? null,
    evidence_refs: r.evidenceRefs ?? [],
    reviewer_id: r.reviewerId ?? null,
    review_note: r.reviewNote ?? null,
    created_at: new Date(r.createdAt).toISOString(),
    updated_at: new Date(r.updatedAt).toISOString(),
    reviewed_at: r.reviewedAt ? new Date(r.reviewedAt).toISOString() : null,
  }
}

async function rest<T>(
  path: string,
  init: RequestInit & { prefer?: string } = {}
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, status: 0, data: null, error: "DB_NOT_CONFIGURED" }
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: env.supabaseServiceRoleKey,
    Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
  }
  if (init.prefer) headers.Prefer = init.prefer
  try {
    const res = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    })
    const text = await res.text()
    let data: T | null = null
    if (text) {
      try {
        data = JSON.parse(text) as T
      } catch {
        data = null
      }
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data,
        error: typeof data === "object" && data && "message" in (data as object)
          ? String((data as { message?: string }).message)
          : text.slice(0, 200) || res.statusText,
      }
    }
    return { ok: true, status: res.status, data }
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: e instanceof Error ? e.message : "fetch_failed",
    }
  }
}

/**
 * Create a pending verification request for the authenticated user.
 * Idempotent for same user+type while a pending row exists.
 */
export async function createVerificationRequest(input: {
  userId: string
  type: VerificationRequestType
  note?: string
  evidenceRefs?: string[]
}): Promise<
  | { ok: true; request: VerificationRequest; idempotent: boolean }
  | { ok: false; error: string; code?: string }
> {
  const userId = String(input.userId || "").trim()
  const type = input.type
  if (!userId) return { ok: false, error: "userId required", code: "INVALID" }
  if (!["identity", "creator", "business", "organization"].includes(type)) {
    return { ok: false, error: "invalid_type", code: "INVALID_TYPE" }
  }

  // Duplicate pending check (memory + DB)
  const existing = await findPendingForUserType(userId, type)
  if (existing) {
    return { ok: true, request: existing, idempotent: true }
  }

  const record: VerificationRequest = {
    id: genVerificationRequestId(),
    userId,
    type,
    status: "pending",
    note: input.note?.slice(0, 500),
    evidenceRefs: (input.evidenceRefs || []).map(String).slice(0, 10),
    createdAt: now(),
    updatedAt: now(),
  }

  mem().set(record.id, record)

  if (!dbConfigured()) {
    if (isProd()) {
      mem().delete(record.id)
      return {
        ok: false,
        error: "DURABLE_REQUIRED: production requires Supabase verification requests schema",
        code: "DURABLE_REQUIRED",
      }
    }
    return { ok: true, request: record, idempotent: false }
  }

  const inserted = await rest<Row[]>("gh_verification_requests", {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify(recordToRow(record)),
  })

  if (!inserted.ok) {
    // Unique pending index conflict → treat as idempotent
    if (
      inserted.status === 409 ||
      (inserted.error && /duplicate|unique/i.test(inserted.error))
    ) {
      const again = await findPendingForUserType(userId, type)
      if (again) return { ok: true, request: again, idempotent: true }
    }
    if (isProd() || dbConfigured()) {
      mem().delete(record.id)
      return {
        ok: false,
        error: inserted.error || "DURABLE_WRITE_FAILED",
        code: "DURABLE_WRITE_FAILED",
      }
    }
  } else if (Array.isArray(inserted.data) && inserted.data[0]) {
    const saved = rowToRecord(inserted.data[0])
    mem().set(saved.id, saved)
    return { ok: true, request: saved, idempotent: false }
  }

  return { ok: true, request: record, idempotent: false }
}

export async function findPendingForUserType(
  userId: string,
  type: VerificationRequestType
): Promise<VerificationRequest | null> {
  // Memory first
  for (const r of mem().values()) {
    if (r.userId === userId && r.type === type && r.status === "pending") return r
  }
  if (!dbConfigured()) return null
  const q = new URLSearchParams({
    user_id: `eq.${userId}`,
    type: `eq.${type}`,
    status: "eq.pending",
    select: "*",
    limit: "1",
  })
  const res = await rest<Row[]>(`gh_verification_requests?${q.toString()}`, {
    method: "GET",
  })
  if (res.ok && Array.isArray(res.data) && res.data[0]) {
    const rec = rowToRecord(res.data[0])
    mem().set(rec.id, rec)
    return rec
  }
  return null
}

export async function listRequestsForUser(
  userId: string
): Promise<VerificationRequest[]> {
  const out = new Map<string, VerificationRequest>()
  for (const r of mem().values()) {
    if (r.userId === userId) out.set(r.id, r)
  }
  if (dbConfigured()) {
    const q = new URLSearchParams({
      user_id: `eq.${userId}`,
      select: "*",
      order: "created_at.desc",
      limit: "50",
    })
    const res = await rest<Row[]>(`gh_verification_requests?${q.toString()}`, {
      method: "GET",
    })
    if (res.ok && Array.isArray(res.data)) {
      for (const row of res.data) {
        const rec = rowToRecord(row)
        out.set(rec.id, rec)
      }
    }
  }
  return [...out.values()].sort((a, b) => b.createdAt - a.createdAt)
}

export async function listPendingForReview(
  limit = 50
): Promise<VerificationRequest[]> {
  const out: VerificationRequest[] = []
  if (dbConfigured()) {
    const q = new URLSearchParams({
      status: "eq.pending",
      select: "*",
      order: "created_at.asc",
      limit: String(Math.min(100, Math.max(1, limit))),
    })
    const res = await rest<Row[]>(`gh_verification_requests?${q.toString()}`, {
      method: "GET",
    })
    if (res.ok && Array.isArray(res.data)) {
      return res.data.map(rowToRecord)
    }
  }
  for (const r of mem().values()) {
    if (r.status === "pending") out.push(r)
  }
  return out.sort((a, b) => a.createdAt - b.createdAt).slice(0, limit)
}

/**
 * Privileged status update for review API only.
 * Does not itself mutate client verification badges — callers must apply domain rules separately.
 */
export async function updateVerificationRequestStatus(input: {
  id?: string
  userId: string
  type: VerificationRequestType
  status: Exclude<VerificationRequestStatus, "pending">
  reviewerId: string
  reviewNote?: string
}): Promise<
  | { ok: true; request: VerificationRequest }
  | { ok: false; error: string; code?: string }
> {
  let target: VerificationRequest | null = null
  if (input.id) {
    target = mem().get(input.id) || null
    if (!target && dbConfigured()) {
      const res = await rest<Row[]>(
        `gh_verification_requests?id=eq.${encodeURIComponent(input.id)}&select=*`,
        { method: "GET" }
      )
      if (res.ok && Array.isArray(res.data) && res.data[0]) {
        target = rowToRecord(res.data[0])
      }
    }
  }
  if (!target) {
    target = await findPendingForUserType(input.userId, input.type)
  }
  if (!target) {
    return { ok: false, error: "request_not_found", code: "NOT_FOUND" }
  }
  if (target.userId !== input.userId) {
    return { ok: false, error: "ownership_mismatch", code: "FORBIDDEN" }
  }

  const updated: VerificationRequest = {
    ...target,
    status: input.status,
    reviewerId: input.reviewerId,
    reviewNote: input.reviewNote?.slice(0, 500),
    updatedAt: now(),
    reviewedAt: now(),
  }
  mem().set(updated.id, updated)

  if (!dbConfigured()) {
    if (isProd()) {
      return {
        ok: false,
        error: "DURABLE_REQUIRED",
        code: "DURABLE_REQUIRED",
      }
    }
    return { ok: true, request: updated }
  }

  const patch = await rest<Row[]>(
    `gh_verification_requests?id=eq.${encodeURIComponent(updated.id)}`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: JSON.stringify({
        status: updated.status,
        reviewer_id: updated.reviewerId ?? null,
        review_note: updated.reviewNote ?? null,
        updated_at: new Date(updated.updatedAt).toISOString(),
        reviewed_at: new Date(updated.reviewedAt || now()).toISOString(),
      }),
    }
  )
  if (!patch.ok) {
    return {
      ok: false,
      error: patch.error || "DURABLE_WRITE_FAILED",
      code: "DURABLE_WRITE_FAILED",
    }
  }
  if (Array.isArray(patch.data) && patch.data[0]) {
    const saved = rowToRecord(patch.data[0])
    mem().set(saved.id, saved)
    return { ok: true, request: saved }
  }
  return { ok: true, request: updated }
}
