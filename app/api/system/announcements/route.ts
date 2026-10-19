import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_LIMIT = 50

type Announcement = {
  id: string
  title: string
  body: string
  severity: "info" | "success" | "warning" | "critical"
  action_path: string | null
  published_at: string
  expires_at: string | null
}

function dbConfig() {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  return {
    base: env.supabaseUrl.replace(/\/$/, "") + "/rest/v1",
    key: env.supabaseServiceRoleKey,
  }
}

async function dbRequest(path: string, init: RequestInit = {}) {
  const db = dbConfig()
  if (!db) throw new Error("DB_UNAVAILABLE")
  const response = await fetch(`${db.base}/${path}`, {
    ...init,
    headers: {
      apikey: db.key,
      Authorization: `Bearer ${db.key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  })
  const raw = await response.text()
  const data = raw ? JSON.parse(raw) : null
  if (!response.ok) throw new Error(`DB_HTTP_${response.status}`)
  return data
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })

  try {
    const url = new URL(request.url)
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get("limit") || 25) || 25))
    const now = new Date().toISOString()
    const rows = await dbRequest(
      `gh_system_announcements?select=id,title,body,severity,action_path,published_at,expires_at&published_at=lte.${encodeURIComponent(now)}&or=(expires_at.is.null,expires_at.gt.${encodeURIComponent(now)})&order=published_at.desc&limit=${limit}`
    ) as Announcement[]

    const ids = Array.isArray(rows) ? rows.map((row) => row.id).filter(Boolean) : []
    let readIds = new Set<string>()
    if (ids.length) {
      const readRows = await dbRequest(
        `gh_system_announcement_reads?select=announcement_id&gh_user_id=eq.${encodeURIComponent(auth.userId)}&announcement_id=in.(${ids.map((id) => encodeURIComponent(id)).join(",")})`
      ) as Array<{ announcement_id: string }>
      readIds = new Set(Array.isArray(readRows) ? readRows.map((row) => row.announcement_id) : [])
    }

    const announcements = (Array.isArray(rows) ? rows : []).map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      severity: row.severity,
      actionPath: row.action_path,
      publishedAt: Date.parse(row.published_at) || 0,
      expiresAt: row.expires_at ? Date.parse(row.expires_at) || null : null,
      read: readIds.has(row.id),
    }))
    return NextResponse.json({ ok: true, durable: true, announcements, unreadCount: announcements.filter((row) => !row.read).length })
  } catch (error) {
    const message = error instanceof Error ? error.message : "ANNOUNCEMENTS_UNAVAILABLE"
    return NextResponse.json({ ok: false, durable: false, announcements: [], error: message }, { status: 503 })
  }
}

export async function POST(request: Request) {
  // Publishing requires a separate high-entropy server secret. Ordinary app sessions
  // can only mark their own announcement as read; they cannot broadcast notices.
  const suppliedAdminKey = request.headers.get("x-greenhaven-announcement-key")
  const configuredAdminKey = process.env.GREENHAVEN_ANNOUNCEMENT_ADMIN_KEY
  if (configuredAdminKey && suppliedAdminKey && suppliedAdminKey === configuredAdminKey) {
    const body = await request.json().catch(() => null) as Partial<Announcement> & { created_by?: string } | null
    if (!body || typeof body.id !== "string" || !/^[a-zA-Z0-9._:-]{1,120}$/.test(body.id) ||
        typeof body.title !== "string" || typeof body.body !== "string") {
      return NextResponse.json({ ok: false, error: "INVALID_ANNOUNCEMENT" }, { status: 400 })
    }
    const title = body.title.trim()
    const content = body.body.trim()
    if (!title || title.length > 160 || !content || content.length > 4000) {
      return NextResponse.json({ ok: false, error: "INVALID_ANNOUNCEMENT" }, { status: 400 })
    }
    const severity: Announcement["severity"] = ["info", "success", "warning", "critical"].includes(String(body.severity)) ? body.severity as Announcement["severity"] : "info"
    const actionPath = body.action_path ?? null
    if (actionPath !== null && (typeof actionPath !== "string" || !actionPath.startsWith("/") || actionPath.startsWith("//"))) {
      return NextResponse.json({ ok: false, error: "INVALID_ACTION_PATH" }, { status: 400 })
    }
    try {
      await dbRequest("gh_system_announcements?on_conflict=id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          id: body.id, title, body: content, severity, action_path: actionPath,
          published_at: body.published_at || new Date().toISOString(),
          expires_at: body.expires_at || null, created_by: "operator", updated_at: new Date().toISOString(),
        }),
      })
      return NextResponse.json({ ok: true, durable: true, id: body.id }, { status: 201 })
    } catch (error) {
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "PUBLISH_FAILED" }, { status: 503 })
    }
  }

  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { action?: string; ids?: unknown[]; id?: string; markAll?: boolean }
  let ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string").slice(0, MAX_LIMIT) :
    typeof body.id === "string" ? [body.id] : []
  if (body.markAll === true || body.action === "mark_all_read") {
    try {
      const now = new Date().toISOString()
      const active = await dbRequest(`gh_system_announcements?select=id&published_at=lte.${encodeURIComponent(now)}&or=(expires_at.is.null,expires_at.gt.${encodeURIComponent(now)})&limit=${MAX_LIMIT}`) as Array<{ id: string }>
      ids = Array.isArray(active) ? active.map((row) => row.id).filter(Boolean) : []
    } catch (error) {
      return NextResponse.json({ ok: false, durable: false, error: error instanceof Error ? error.message : "ANNOUNCEMENTS_UNAVAILABLE" }, { status: 503 })
    }
  }
  if (!ids.length) return NextResponse.json({ ok: true, durable: true, updated: 0 })
  if (ids.some((id) => !/^[a-zA-Z0-9._:-]{1,120}$/.test(id))) {
    return NextResponse.json({ ok: false, error: "INVALID_IDS" }, { status: 400 })
  }
  try {
    const payload = ids.map((announcement_id) => ({ announcement_id, gh_user_id: auth.userId, read_at: new Date().toISOString() }))
    await dbRequest("gh_system_announcement_reads?on_conflict=announcement_id,gh_user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(payload),
    })
    return NextResponse.json({ ok: true, durable: true, updated: ids.length })
  } catch (error) {
    return NextResponse.json({ ok: false, durable: false, error: error instanceof Error ? error.message : "MARK_READ_FAILED" }, { status: 503 })
  }
}
