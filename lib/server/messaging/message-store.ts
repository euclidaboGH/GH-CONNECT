/**
 * Durable messaging store (server-only).
 * Authorization: every read/write checks conversation membership for auth.userId.
 * Idempotency: client_message_id unique per (conversation, sender).
 * Production refuses process-memory as sole authority.
 */

import { createHash, randomBytes } from "crypto"
import { readGhcServerEnv, hasPrivilegedDatabase } from "@/lib/server/economy/env"

export type ConversationKind = "direct" | "group" | "community"

export type DurableConversation = {
  id: string
  kind: ConversationKind
  title: string | null
  createdBy: string
  createdAt: number
  updatedAt: number
  lastMessageAt: number | null
  lastMessagePreview: string | null
  memberIds: string[]
  unreadCount?: number
}

export type DurableMediaAttachment = {
  id: string
  type: "image" | "video" | "file"
  url: string
  fileName?: string
  mimeType?: string
  sizeBytes?: number
}

export type DurableMessage = {
  id: string
  conversationId: string
  senderId: string
  clientMessageId: string | null
  body: string
  status: string
  createdAt: number
  editedAt: number | null
  deletedAt: number | null
  deletedBy: string | null
  isPinned?: boolean
  replyTo?: string
  replyToPreview?: { senderName: string; text: string }
  sharedPostId?: string
  mediaAttachments?: DurableMediaAttachment[]
  deliveredAt?: number | null
  readAt?: number | null
}

const memConv = new Map<string, DurableConversation>()
const memMembers = new Map<string, Set<string>>() // convId -> user ids
const memMessages = new Map<string, DurableMessage[]>() // convId -> messages
const memPresence = new Map<string, { lastSeenAt: number; onlineUntil: number; typingConversationId?: string; typingUntil?: number }>()


function communityIdVariants(id: string): string[] {
  const c = String(id || "").trim()
  if (!c) return []
  const out = new Set<string>([c])
  if (c.startsWith("community:")) out.add(c.slice("community:".length))
  else out.add(`community:${c}`)
  if (c.startsWith("group:")) out.add(c.slice("group:".length))
  else out.add(`group:${c}`)
  return [...out]
}

function dbConfigured() {
  return hasPrivilegedDatabase()
}

function isProd() {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    process.env.GHC_ENV === "production"
  )
}

function newId(prefix: string) {
  return `${prefix}_${randomBytes(12).toString("hex")}`
}

function previewOf(body: string) {
  const t = body.replace(/\s+/g, " ").trim()
  return t.slice(0, 140)
}
function isHttpOrStorageUrl(url: string): boolean {
  const u = String(url || "").trim()
  if (!u || u.length > 2048) return false
  if (u.startsWith("blob:") || u.startsWith("data:")) return false
  try {
    const parsed = new URL(u)
    return parsed.protocol === "https:"
  } catch {
    return false
  }
}

function normalizeAttachments(
  raw: unknown
): DurableMediaAttachment[] {
  if (!Array.isArray(raw)) return []
  const out: DurableMediaAttachment[] = []
  for (const item of raw.slice(0, 4)) {
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const url = String(o.url || "").trim()
    if (!isHttpOrStorageUrl(url)) continue
    const typeRaw = String(o.type || "file").toLowerCase()
    const type: DurableMediaAttachment["type"] =
      typeRaw === "image" || typeRaw === "video" || typeRaw === "file" ? typeRaw : "file"
    const id = String(o.id || "").trim().slice(0, 80) || newId("att")
    const fileName = o.fileName != null ? String(o.fileName).slice(0, 180) : undefined
    const mimeType = o.mimeType != null ? String(o.mimeType).slice(0, 120) : undefined
    const sizeBytes = typeof o.sizeBytes === "number" && Number.isFinite(o.sizeBytes)
      ? Math.max(0, Math.floor(o.sizeBytes))
      : undefined
    out.push({ id, type, url, fileName, mimeType, sizeBytes })
  }
  return out
}

function mediaPreviewLabel(atts: DurableMediaAttachment[]): string {
  if (!atts.length) return ""
  const first = atts[0]
  if (atts.length === 1) {
    if (first.type === "image") return "📷 Photo"
    if (first.type === "video") return "🎥 Video"
    return `📎 ${first.fileName || "File"}`
  }
  return `📎 ${atts.length} attachments`
}


async function rest<T>(
  path: string,
  init?: RequestInit & { prefer?: string }
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false, status: 0, data: null }
  }
  try {
    const headers: Record<string, string> = {
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      Accept: "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    }
    if (init?.prefer) headers.Prefer = init.prefer
    if (init?.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json"
    }
    const res = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: init?.signal || AbortSignal.timeout(8_000),
    })
    if (res.status === 204) return { ok: res.ok, status: res.status, data: null }
    const data = (await res.json().catch(() => null)) as T | null
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: null }
  }
}

export function isMessagingStoreDurable(): boolean {
  return dbConfigured()
}

export async function isMember(
  conversationId: string,
  ghUserId: string
): Promise<boolean> {
  const cid = String(conversationId || "").trim()
  const uid = String(ghUserId || "").trim()
  if (!cid || !uid) return false

  if (dbConfigured()) {
    const q = `gh_conversation_members?conversation_id=eq.${encodeURIComponent(cid)}&gh_user_id=eq.${encodeURIComponent(uid)}&left_at=is.null&select=gh_user_id&limit=1`
    const { ok, data } = await rest<Array<{ gh_user_id: string }>>(q)
    if (ok && Array.isArray(data) && data.length > 0) return true
    if (ok) return false
    // DB configured but request failed: fail closed (do not trust process memory for authz)
    return false
  }
  if (isProd()) return false
  const set = memMembers.get(cid)
  return Boolean(set?.has(uid))
}

export async function listConversationsForUser(
  ghUserId: string,
  opts?: { limit?: number }
): Promise<DurableConversation[]> {
  const uid = String(ghUserId || "").trim()
  if (!uid) return []
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100)

  if (dbConfigured()) {
    const memQ = `gh_conversation_members?gh_user_id=eq.${encodeURIComponent(uid)}&left_at=is.null&select=conversation_id&limit=${limit}`
    const memRes = await rest<Array<{ conversation_id: string }>>(memQ)
    if (!memRes.ok || !Array.isArray(memRes.data)) return []
    {
      const ids = memRes.data.map((r) => r.conversation_id).filter(Boolean)
      if (ids.length === 0) return []
      const inList = ids.map(encodeURIComponent).join(",")
      const convQ = `gh_conversations?id=in.(${inList})&select=*&order=updated_at.desc`
      const convRes = await rest<Array<Record<string, unknown>>>(convQ)
      if (!convRes.ok || !Array.isArray(convRes.data)) return []
      {
        const out: DurableConversation[] = []
        const memberRows = await rest<Array<{ conversation_id: string; gh_user_id: string }>>(
          `gh_conversation_members?conversation_id=in.(${inList})&left_at=is.null&select=conversation_id,gh_user_id`
        )
        const membersByConversation = new Map<string, string[]>()
        if (memberRows.ok && Array.isArray(memberRows.data)) {
          for (const member of memberRows.data) {
            const list = membersByConversation.get(member.conversation_id) || []
            list.push(member.gh_user_id)
            membersByConversation.set(member.conversation_id, list)
          }
        }
        const conversationIds = convRes.data.map((row) => String(row.id || "")).filter(Boolean)
        const unreadResult = conversationIds.length
          ? await rest<Array<{ conversation_id: string; unread_count: number | string }>>("rpc/gh_messaging_unread_counts", {
              method: "POST",
              body: JSON.stringify({ p_user_id: uid, p_conversation_ids: conversationIds }),
            })
          : { ok: true, status: 200, data: [] as Array<{ conversation_id: string; unread_count: number | string }> }
        const unreadCounts = new Map<string, number>()
        if (unreadResult.ok && Array.isArray(unreadResult.data)) {
          for (const item of unreadResult.data) unreadCounts.set(item.conversation_id, Math.max(0, Number(item.unread_count) || 0))
        }
        for (const row of convRes.data) {
          const id = String(row.id || "")
          const members = membersByConversation.get(id) || []
          out.push({
            id,
            kind: (row.kind as ConversationKind) || "direct",
            title: row.title != null ? String(row.title) : null,
            createdBy: String(row.created_by || ""),
            createdAt: row.created_at ? Date.parse(String(row.created_at)) : Date.now(),
            updatedAt: row.updated_at ? Date.parse(String(row.updated_at)) : Date.now(),
            lastMessageAt: row.last_message_at
              ? Date.parse(String(row.last_message_at))
              : null,
            lastMessagePreview:
              row.last_message_preview != null
                ? String(row.last_message_preview)
                : null,
            memberIds: members,
            ...(unreadResult.ok && Array.isArray(unreadResult.data) ? { unreadCount: unreadCounts.get(id) || 0 } : {}),
          })
        }
        return out
      }
    }
  }

  if (isProd()) return []
  const result: DurableConversation[] = []
  for (const [cid, set] of memMembers) {
    if (set.has(uid)) {
      const c = memConv.get(cid)
      if (c) result.push({ ...c, memberIds: [...set] })
    }
  }
  return result
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
}

async function listMemberIds(conversationId: string): Promise<string[]> {
  if (dbConfigured()) {
    const q = `gh_conversation_members?conversation_id=eq.${encodeURIComponent(conversationId)}&left_at=is.null&select=gh_user_id`
    const { ok, data } = await rest<Array<{ gh_user_id: string }>>(q)
    if (ok && Array.isArray(data)) return data.map((r) => r.gh_user_id)
    return []
  }
  if (isProd()) return []
  return [...(memMembers.get(conversationId) || [])]
}

export type MessagingAudience = "everyone" | "matches-only" | "no-one"
export type OnlineStatusAudience = "everyone" | "matches-only" | "hidden"
export type DirectMessagePermission = { allowed: true } | { allowed: false; error: "BLOCKED" | "PRIVACY_RESTRICTED" | "PRIVACY_SETTINGS_UNCONFIGURED" | "STORE_UNAVAILABLE" }

export async function getMessagingPreference(userId: string): Promise<{
  whoCanMessage: MessagingAudience
  onlineStatus: OnlineStatusAudience
  configured: boolean
  whoCanMessageConfigured: boolean
  onlineStatusConfigured: boolean
} | null> {
  const uid = String(userId || "").trim()
  if (!uid) return null
  if (!dbConfigured()) return isProd() ? null : { whoCanMessage: "everyone", onlineStatus: "everyone", configured: true, whoCanMessageConfigured: true, onlineStatusConfigured: true }
  const result = await rest<Array<{ who_can_message: string; who_can_message_configured: boolean; online_status: string; online_status_configured: boolean }>>(
    `gh_messaging_preferences?user_id=eq.${encodeURIComponent(uid)}&select=who_can_message,who_can_message_configured,online_status,online_status_configured&limit=1`
  )
  if (!result.ok || !Array.isArray(result.data)) return null
  const row = result.data[0]
  if (!row) return { whoCanMessage: "everyone", onlineStatus: "everyone", configured: false, whoCanMessageConfigured: false, onlineStatusConfigured: false }
  const whoCanMessage = row.who_can_message
  const onlineStatus = row.online_status
  if ((whoCanMessage !== "everyone" && whoCanMessage !== "matches-only" && whoCanMessage !== "no-one") || (onlineStatus !== "everyone" && onlineStatus !== "matches-only" && onlineStatus !== "hidden")) return null
  const whoCanMessageConfigured = Boolean(row.who_can_message_configured)
  const onlineStatusConfigured = Boolean(row.online_status_configured)
  return { whoCanMessage, onlineStatus, configured: whoCanMessageConfigured, whoCanMessageConfigured, onlineStatusConfigured }
}

export async function setMessagingPreference(input: {
  userId: string
  whoCanMessage?: MessagingAudience
  onlineStatus?: OnlineStatusAudience
  onlyIfUnconfigured?: boolean
}): Promise<{ ok: true; durable: boolean } | { ok: false; error: string }> {
  const uid = String(input.userId || "").trim()
  const hasWho = input.whoCanMessage !== undefined
  const hasOnline = input.onlineStatus !== undefined
  if (!uid || (!hasWho && !hasOnline) || (hasWho && !["everyone", "matches-only", "no-one"].includes(input.whoCanMessage as string)) || (hasOnline && !["everyone", "matches-only", "hidden"].includes(input.onlineStatus as string))) return { ok: false, error: "INVALID_PREFERENCE" }
  if (!dbConfigured()) return isProd() ? { ok: false, error: "STORE_UNAVAILABLE" } : { ok: true, durable: false }
  const updatedAt = new Date().toISOString()
  if (input.onlyIfUnconfigured) {
    const current = await rest<Array<{ who_can_message_configured: boolean; online_status_configured: boolean }>>(
      `gh_messaging_preferences?user_id=eq.${encodeURIComponent(uid)}&select=who_can_message_configured,online_status_configured&limit=1`
    )
    if (!current.ok || !Array.isArray(current.data)) return { ok: false, error: "PREFERENCE_READ_FAILED" }
    const row = current.data[0]
    if (!row) {
      const body: Record<string, unknown> = { user_id: uid, updated_at: updatedAt }
      if (hasWho) Object.assign(body, { who_can_message: input.whoCanMessage, who_can_message_configured: true })
      if (hasOnline) Object.assign(body, { online_status: input.onlineStatus, online_status_configured: true })
      const inserted = await rest("gh_messaging_preferences", { method: "POST", prefer: "resolution=ignore-duplicates,return=minimal", body: JSON.stringify(body) })
      return inserted.ok ? { ok: true, durable: true } : { ok: false, error: "PREFERENCE_SAVE_FAILED" }
    }
    if (hasWho && !row.who_can_message_configured) {
      const saved = await rest(`gh_messaging_preferences?user_id=eq.${encodeURIComponent(uid)}&who_can_message_configured=eq.false`, {
        method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ who_can_message: input.whoCanMessage, who_can_message_configured: true, updated_at: updatedAt }),
      })
      if (!saved.ok) return { ok: false, error: "PREFERENCE_SAVE_FAILED" }
    }
    if (hasOnline && !row.online_status_configured) {
      const saved = await rest(`gh_messaging_preferences?user_id=eq.${encodeURIComponent(uid)}&online_status_configured=eq.false`, {
        method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ online_status: input.onlineStatus, online_status_configured: true, updated_at: updatedAt }),
      })
      if (!saved.ok) return { ok: false, error: "PREFERENCE_SAVE_FAILED" }
    }
    return { ok: true, durable: true }
  }
  const body: Record<string, unknown> = { user_id: uid, updated_at: updatedAt }
  if (hasWho) Object.assign(body, { who_can_message: input.whoCanMessage, who_can_message_configured: true })
  if (hasOnline) Object.assign(body, { online_status: input.onlineStatus, online_status_configured: true })
  const result = await rest("gh_messaging_preferences", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: JSON.stringify(body),
  })
  return result.ok ? { ok: true, durable: true } : { ok: false, error: "PREFERENCE_SAVE_FAILED" }
}

async function getMutuallyConnectedUserIds(viewerId: string, subjectIds: string[]): Promise<Set<string> | null> {
  const viewer = String(viewerId || "").trim()
  const subjects = Array.from(new Set(subjectIds.map((id) => String(id || "").trim()).filter((id) => id && id !== viewer)))
  const connected = new Set<string>()
  if (!viewer || !subjects.length) return connected
  if (!dbConfigured()) return isProd() ? null : connected
  const inList = subjects.map((id) => encodeURIComponent(id)).join(",")
  const follows = await rest<Array<{ follower_id: string; following_id: string }>>(
    `gh_follows?or=(and(follower_id.eq.${encodeURIComponent(viewer)},following_id.in.(${inList})),and(follower_id.in.(${inList}),following_id.eq.${encodeURIComponent(viewer)}))&select=follower_id,following_id&limit=1000`
  )
  if (!follows.ok || !Array.isArray(follows.data)) return null
  const viewerFollows = new Set(follows.data.filter((row) => row.follower_id === viewer).map((row) => row.following_id))
  const followsViewer = new Set(follows.data.filter((row) => row.following_id === viewer).map((row) => row.follower_id))
  for (const subject of subjects) if (viewerFollows.has(subject) && followsViewer.has(subject)) connected.add(subject)
  const remaining = subjects.filter((subject) => !connected.has(subject))
  if (!remaining.length) return connected
  const remainingIn = remaining.map((id) => encodeURIComponent(id)).join(",")
  const matches = await rest<Array<{ from_user_id: string; to_user_id: string; signal: string }>>(
    `ghc_match_signals?or=(and(from_user_id.eq.${encodeURIComponent(viewer)},to_user_id.in.(${remainingIn}),signal.in.(like,superlike)),and(from_user_id.in.(${remainingIn}),to_user_id.eq.${encodeURIComponent(viewer)},signal.in.(like,superlike)))&select=from_user_id,to_user_id,signal&limit=1000`
  )
  // If match signals are unavailable, reciprocal follows already verified above remain valid;
  // other peers fail closed rather than being treated as matches.
  if (!matches.ok || !Array.isArray(matches.data)) return connected
  const viewerLikes = new Set(matches.data.filter((row) => row.from_user_id === viewer && (row.signal === "like" || row.signal === "superlike")).map((row) => row.to_user_id))
  const peersLikeViewer = new Set(matches.data.filter((row) => row.to_user_id === viewer && (row.signal === "like" || row.signal === "superlike")).map((row) => row.from_user_id))
  for (const subject of remaining) if (viewerLikes.has(subject) && peersLikeViewer.has(subject)) connected.add(subject)
  return connected
}

async function areUsersMutuallyConnected(a: string, b: string): Promise<boolean | null> {
  const connected = await getMutuallyConnectedUserIds(a, [b])
  return connected === null ? null : connected.has(b)
}

async function getVisiblePresencePeerIds(viewerId: string, subjectIds: string[]): Promise<Set<string>> {
  const viewer = String(viewerId || "").trim()
  const subjects = Array.from(new Set(subjectIds.map((id) => String(id || "").trim()).filter((id) => id && id !== viewer)))
  const visible = new Set<string>()
  if (!viewer || !subjects.length) return visible
  if (!dbConfigured()) {
    if (!isProd()) for (const subject of subjects) visible.add(subject)
    return visible
  }
  const inList = subjects.map((id) => encodeURIComponent(id)).join(",")
  const [preferences, blocks] = await Promise.all([
    rest<Array<{ user_id: string; online_status: string; online_status_configured: boolean }>>(
      `gh_messaging_preferences?user_id=in.(${inList})&select=user_id,online_status,online_status_configured&limit=1000`
    ),
    rest<Array<{ blocker_id: string; blocked_id: string }>>(
      `ghc_user_blocks?or=(and(blocker_id.eq.${encodeURIComponent(viewer)},blocked_id.in.(${inList})),and(blocker_id.in.(${inList}),blocked_id.eq.${encodeURIComponent(viewer)}))&select=blocker_id,blocked_id&limit=1000`
    ),
  ])
  if (!preferences.ok || !Array.isArray(preferences.data) || !blocks.ok || !Array.isArray(blocks.data)) return visible
  const preferenceById = new Map(preferences.data.map((row) => [row.user_id, row]))
  const blocked = new Set<string>()
  for (const row of blocks.data) {
    if (row.blocker_id === viewer) blocked.add(row.blocked_id)
    if (row.blocked_id === viewer) blocked.add(row.blocker_id)
  }
  const matchesOnly: string[] = []
  for (const subject of subjects) {
    if (blocked.has(subject)) continue
    const preference = preferenceById.get(subject)
    if (!preference || !preference.online_status_configured) continue
    if (preference.online_status === "everyone") visible.add(subject)
    else if (preference.online_status === "matches-only") matchesOnly.push(subject)
  }
  if (matchesOnly.length) {
    const connected = await getMutuallyConnectedUserIds(viewer, matchesOnly)
    if (connected) for (const subject of connected) visible.add(subject)
  }
  return visible
}

export async function canReceiveDirectMessage(senderId: string, recipientId: string): Promise<DirectMessagePermission> {
  const sender = String(senderId || "").trim()
  const recipient = String(recipientId || "").trim()
  if (!sender || !recipient || sender === recipient) return { allowed: false, error: "PRIVACY_RESTRICTED" }
  if (dbConfigured()) {
    const knownUser = await rest<Array<{ gh_user_id: string }>>(
      `gh_pi_identities?gh_user_id=eq.${encodeURIComponent(recipient)}&select=gh_user_id&limit=1`
    )
    if (!knownUser.ok || !Array.isArray(knownUser.data)) return { allowed: false, error: "STORE_UNAVAILABLE" }
    if (!knownUser.data.length) return { allowed: false, error: "PRIVACY_RESTRICTED" }
  } else if (isProd()) {
    return { allowed: false, error: "STORE_UNAVAILABLE" }
  }
  if (await areUsersBlocked(sender, recipient)) return { allowed: false, error: "BLOCKED" }
  const preference = await getMessagingPreference(recipient)
  if (!preference) return { allowed: false, error: "STORE_UNAVAILABLE" }
  // Legacy settings were device-local. Until the recipient's first authenticated session
  // migrates them to the server, deny new DMs rather than assuming they accept everyone.
  if (!preference.whoCanMessageConfigured) return { allowed: false, error: "PRIVACY_SETTINGS_UNCONFIGURED" }
  if (preference.whoCanMessage === "no-one") return { allowed: false, error: "PRIVACY_RESTRICTED" }
  if (preference.whoCanMessage === "matches-only") {
    const connected = await areUsersMutuallyConnected(sender, recipient)
    if (connected === null) return { allowed: false, error: "STORE_UNAVAILABLE" }
    if (!connected) return { allowed: false, error: "PRIVACY_RESTRICTED" }
  }
  return { allowed: true }
}

/** Respect the subject's online-status privacy separately from their DM privacy. */
export async function canViewMessagingPresence(viewerId: string, subjectId: string): Promise<boolean> {
  const viewer = String(viewerId || "").trim()
  const subject = String(subjectId || "").trim()
  if (!viewer || !subject || viewer === subject) return false
  return (await getVisiblePresencePeerIds(viewer, [subject])).has(subject)
}

export async function createDirectConversation(input: {
  creatorId: string
  otherUserId: string
}): Promise<DurableConversation | null | { denied: "BLOCKED" | "PRIVACY_RESTRICTED" | "PRIVACY_SETTINGS_UNCONFIGURED" | "STORE_UNAVAILABLE" }> {
  const a = String(input.creatorId || "").trim()
  const b = String(input.otherUserId || "").trim()
  if (!a || !b || a === b) return null

  // Stable id for direct pairs (sorted) — prevents duplicate DM threads.
  const pair = [a, b].sort()
  const id = `dm_${createHash("sha256").update(pair.join(":")).digest("hex").slice(0, 24)}`

  // Existing members may reopen/read their established thread even after a privacy change;
  // the send path independently enforces current recipient policy for every new message.
  if (await isMember(id, a)) {
    const list = await listConversationsForUser(a, { limit: 100 })
    const existing = list.find((c) => c.id === id)
    if (existing && pair.every((memberId) => existing.memberIds.includes(memberId))) return existing
  }

  const permission = await canReceiveDirectMessage(a, b)
  if (!permission.allowed) return { denied: permission.error }

  const t = Date.now()
  const conv: DurableConversation = {
    id,
    kind: "direct",
    title: null,
    createdBy: a,
    createdAt: t,
    updatedAt: t,
    lastMessageAt: null,
    lastMessagePreview: null,
    memberIds: pair,
  }

  if (dbConfigured()) {
    const up = await rest("gh_conversations", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: JSON.stringify({
        id: conv.id,
        kind: "direct",
        created_by: a,
        updated_at: new Date(t).toISOString(),
      }),
    })
    if (!up.ok && isProd()) {
      console.error("[messaging] create conversation failed", up.status)
      return null
    }
    const memberWrites = await Promise.all(pair.map((uid) => rest("gh_conversation_members", {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: JSON.stringify({
        conversation_id: id,
        gh_user_id: uid,
        role: uid === a ? "owner" : "member",
      }),
    })))
    if (memberWrites.some((result) => !result.ok) && isProd()) {
      console.error("[messaging] conversation membership write failed")
      return null
    }
  } else if (isProd()) {
    return null
  }

  memConv.set(id, conv)
  memMembers.set(id, new Set(pair))
  return conv
}


/** Ensure a community/group conversation exists and owner is a member. */
export async function ensureCommunityConversation(input: {
  communityId: string
  ownerId: string
  title?: string | null
}): Promise<{ ok: true; conversationId: string } | { ok: false; error: string }> {
  const cid = String(input.communityId || "").trim()
  const uid = String(input.ownerId || "").trim()
  if (!cid || !uid) return { ok: false, error: "INVALID_INPUT" }

  if (await isMember(cid, uid)) {
    return { ok: true, conversationId: cid }
  }

  const now = Date.now()
  if (dbConfigured()) {
    await rest("gh_conversations", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: JSON.stringify({
        id: cid,
        kind: "community",
        title: input.title ? String(input.title).slice(0, 120) : null,
        created_by: uid,
        updated_at: new Date(now).toISOString(),
      }),
    })
    const mem = await rest("gh_conversation_members", {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: JSON.stringify({
        conversation_id: cid,
        gh_user_id: uid,
        role: "owner",
      }),
    })
    if (!mem.ok && mem.status !== 409) {
      if (isProd()) console.error("[messaging] ensure community membership failed", mem.status)
      return { ok: false, error: "MEMBERSHIP_WRITE_FAILED" }
    }
  } else if (isProd()) {
    return { ok: false, error: "STORE_UNAVAILABLE" }
  }

  const set = memMembers.get(cid) || new Set<string>()
  set.add(uid)
  memMembers.set(cid, set)
  if (!memConv.has(cid)) {
    memConv.set(cid, {
      id: cid,
      kind: "community",
      title: input.title || null,
      createdBy: uid,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: null,
      lastMessagePreview: null,
      memberIds: [uid],
    })
  }
  return { ok: true, conversationId: cid }
}

/** Add an active member to a community conversation (idempotent). */
export async function ensureCommunityMember(input: {
  communityId: string
  userId: string
  role?: "owner" | "member" | "admin"
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const cid = String(input.communityId || "").trim()
  const uid = String(input.userId || "").trim()
  if (!cid || !uid) return { ok: false, error: "INVALID_INPUT" }
  for (const vid of communityIdVariants(cid)) {
    if (await isMember(vid, uid)) return { ok: true }
  }

  if (dbConfigured()) {
    const exists = await rest<Array<{ id: string }>>(
      `gh_conversations?id=eq.${encodeURIComponent(cid)}&select=id&limit=1`
    )
    if (exists.ok && Array.isArray(exists.data) && exists.data.length === 0) {
      await rest("gh_conversations", {
        method: "POST",
        prefer: "resolution=merge-duplicates",
        body: JSON.stringify({
          id: cid,
          kind: "community",
          created_by: uid,
          updated_at: new Date().toISOString(),
        }),
      })
    }
    const mem = await rest("gh_conversation_members", {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: JSON.stringify({
        conversation_id: cid,
        gh_user_id: uid,
        role: input.role || "member",
      }),
    })
    if (!mem.ok && mem.status !== 409) {
      return { ok: false, error: "MEMBERSHIP_WRITE_FAILED" }
    }
  } else if (isProd()) {
    return { ok: false, error: "STORE_UNAVAILABLE" }
  }
  const set = memMembers.get(cid) || new Set<string>()
  set.add(uid)
  memMembers.set(cid, set)
  return { ok: true }
}

export async function listMessages(input: {
  conversationId: string
  ghUserId: string
  limit?: number
  before?: string | null // ISO or ms cursor on created_at
}): Promise<{ ok: true; messages: DurableMessage[] } | { ok: false; error: string }> {
  const cid = String(input.conversationId || "").trim()
  const uid = String(input.ghUserId || "").trim()
  if (!(await isMember(cid, uid))) {
    return { ok: false, error: "FORBIDDEN" }
  }
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100)

  if (dbConfigured()) {
    let q = `gh_messages?conversation_id=eq.${encodeURIComponent(cid)}&select=*&order=created_at.desc&limit=${limit}`
    if (input.before) {
      const cursor = String(input.before).trim()
      const numericCursor = cursor !== "" ? Number(cursor) : Number.NaN
      let cursorMs: number
      if (Number.isFinite(numericCursor)) {
        if (Math.abs(numericCursor) > 8.64e15) return { ok: false, error: "INVALID_CURSOR" }
        cursorMs = numericCursor
      } else {
        cursorMs = Date.parse(cursor)
      }
      if (!Number.isFinite(cursorMs) || Math.abs(cursorMs) > 8.64e15) return { ok: false, error: "INVALID_CURSOR" }
      const beforeIso = new Date(cursorMs).toISOString()
      q += `&created_at=lt.${encodeURIComponent(beforeIso)}`
    }
    const { ok, data } = await rest<Array<Record<string, unknown>>>(q)
    if (ok && Array.isArray(data)) {
      const rows = [...data].reverse()
      const incomingRows = rows
        .filter((row) => String(row.sender_id || "") !== uid && !row.deleted_at)
        .map((row) => ({ id: String(row.id || ""), senderId: String(row.sender_id || "") }))
        .filter((row) => row.id && row.senderId)
      if (incomingRows.length) await markMessagesDelivered(cid, uid, incomingRows)
      const ids = rows.map((row) => String(row.id || "")).filter(Boolean)
      const receiptsByMessage = new Map<string, Array<{ recipient_id: string; delivered_at: string | null; read_at: string | null }>>()
      if (ids.length) {
        const inList = ids.map((id) => encodeURIComponent(id)).join(",")
        const receipts = await rest<Array<{ message_id: string; recipient_id: string; delivered_at: string | null; read_at: string | null }>>(
          `gh_message_receipts?conversation_id=eq.${encodeURIComponent(cid)}&message_id=in.(${inList})&select=message_id,recipient_id,delivered_at,read_at`
        )
        if (receipts.ok && Array.isArray(receipts.data)) {
          for (const receipt of receipts.data) {
            const list = receiptsByMessage.get(receipt.message_id) || []
            list.push(receipt)
            receiptsByMessage.set(receipt.message_id, list)
          }
        }
      }
      const members = await listMemberIds(cid)
      const messages = rows.map((row) => {
        const message = rowToMessage(row)
        if (message.deletedAt) {
          message.status = "deleted"
          return message
        }
        const receipts = receiptsByMessage.get(message.id) || []
        if (message.senderId === uid) {
          const recipients = members.filter((memberId) => memberId !== uid)
          if (recipients.length && receipts.length) {
            const allRead = recipients.every((recipientId) => receipts.some((receipt) => receipt.recipient_id === recipientId && Boolean(receipt.read_at)))
            const allDelivered = recipients.every((recipientId) => receipts.some((receipt) => receipt.recipient_id === recipientId && Boolean(receipt.delivered_at)))
            message.status = allRead ? "read" : allDelivered ? "delivered" : "sent"
            const readTimes = receipts.filter((receipt) => receipt.read_at).map((receipt) => Date.parse(String(receipt.read_at)))
            const deliveredTimes = receipts.filter((receipt) => receipt.delivered_at).map((receipt) => Date.parse(String(receipt.delivered_at)))
            message.readAt = readTimes.length ? Math.max(...readTimes) : null
            message.deliveredAt = deliveredTimes.length ? Math.max(...deliveredTimes) : null
          } else {
            message.status = "sent"
          }
        } else {
          const ownReceipt = receipts.find((receipt) => receipt.recipient_id === uid)
          message.status = ownReceipt?.read_at ? "read" : ownReceipt?.delivered_at ? "delivered" : "sent"
          message.deliveredAt = ownReceipt?.delivered_at ? Date.parse(ownReceipt.delivered_at) : null
          message.readAt = ownReceipt?.read_at ? Date.parse(ownReceipt.read_at) : null
        }
        return message
      })
      return { ok: true, messages }
    }
    if (isProd()) return { ok: false, error: "STORE_UNAVAILABLE" }
  }

  const all = memMessages.get(cid) || []
  let filtered = all
  if (input.before) {
    const ts = Number(input.before) || Date.parse(String(input.before))
    if (ts) filtered = all.filter((m) => m.createdAt < ts)
  }
  return { ok: true, messages: filtered.slice(-limit) }
}

function rowToMessage(row: Record<string, unknown>): DurableMessage {
  return {
    id: String(row.id || ""),
    conversationId: String(row.conversation_id || ""),
    senderId: String(row.sender_id || ""),
    clientMessageId:
      row.client_message_id != null ? String(row.client_message_id) : null,
    body: row.deleted_at ? "" : String(row.body || ""),
    status: String(row.status || "sent"),
    createdAt: row.created_at ? Date.parse(String(row.created_at)) : Date.now(),
    editedAt: row.edited_at ? Date.parse(String(row.edited_at)) : null,
    deletedAt: row.deleted_at ? Date.parse(String(row.deleted_at)) : null,
    deletedBy: row.deleted_by != null ? String(row.deleted_by) : null,
    isPinned: Boolean(row.is_pinned),
    mediaAttachments: (() => {
      const meta = row.meta && typeof row.meta === "object" ? (row.meta as Record<string, unknown>) : {}
      const atts = normalizeAttachments(meta.attachments ?? meta.mediaAttachments)
      return atts.length ? atts : undefined
    })(),
    replyTo: typeof (row.meta as Record<string, unknown> | null)?.replyToMessageId === "string"
      ? String((row.meta as Record<string, unknown>).replyToMessageId)
      : undefined,
    replyToPreview: (() => {
      const meta = row.meta && typeof row.meta === "object" ? row.meta as Record<string, unknown> : {}
      const preview = meta.replyToPreview && typeof meta.replyToPreview === "object" ? meta.replyToPreview as Record<string, unknown> : null
      if (!preview) return undefined
      return { senderName: String(preview.senderName || "Original message").slice(0, 120), text: String(preview.text || "").slice(0, 160) }
    })(),
    sharedPostId: (() => {
      const meta = row.meta && typeof row.meta === "object" ? row.meta as Record<string, unknown> : {}
      return typeof meta.sharedPostId === "string" ? meta.sharedPostId.slice(0, 180) : undefined
    })(),
  }
}

async function validateSharedPostForConversation(input: { senderId: string; conversationId: string; postId: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!dbConfigured()) return { ok: false, error: "STORE_UNAVAILABLE" }
  const postResult = await rest<Array<{ id: string; author_id: string; visibility: string; deleted_at: string | null }>>(
    `gh_posts?id=eq.${encodeURIComponent(input.postId)}&select=id,author_id,visibility,deleted_at&limit=1`
  )
  if (!postResult.ok || !Array.isArray(postResult.data)) return { ok: false, error: "STORE_UNAVAILABLE" }
  const post = postResult.data[0]
  if (!post || post.deleted_at) return { ok: false, error: "INVALID_SHARED_POST" }
  const authorId = String(post.author_id || "")
  if (!authorId) return { ok: false, error: "INVALID_SHARED_POST" }
  const members = await listMemberIds(input.conversationId)
  const recipients = Array.from(new Set(members.filter((memberId) => memberId && memberId !== input.senderId)))
  if (!recipients.length) return { ok: false, error: "FORBIDDEN" }

  const people = Array.from(new Set([input.senderId, ...recipients])).filter((userId) => userId !== authorId)
  if (people.length) {
    const inList = people.map((userId) => encodeURIComponent(userId)).join(",")
    const blocks = await rest<Array<{ blocker_id: string; blocked_id: string }>>(
      `ghc_user_blocks?or=(and(blocker_id.eq.${encodeURIComponent(authorId)},blocked_id.in.(${inList})),and(blocker_id.in.(${inList}),blocked_id.eq.${encodeURIComponent(authorId)}))&select=blocker_id,blocked_id&limit=1000`
    )
    if (!blocks.ok || !Array.isArray(blocks.data)) return { ok: false, error: "STORE_UNAVAILABLE" }
    if (blocks.data.length) return { ok: false, error: "SHARED_POST_PRIVATE" }
  }

  const visibility = String(post.visibility || "")
  if (visibility === "public") return { ok: true }
  if (visibility === "private") return { ok: false, error: "SHARED_POST_PRIVATE" }
  if (visibility !== "followers" && visibility !== "mutuals") return { ok: false, error: "SHARED_POST_PRIVATE" }
  const audience = people
  if (!audience.length) return { ok: true }
  const audienceIn = audience.map((userId) => encodeURIComponent(userId)).join(",")
  if (visibility === "followers") {
    const follows = await rest<Array<{ follower_id: string }>>(
      `gh_follows?following_id=eq.${encodeURIComponent(authorId)}&follower_id=in.(${audienceIn})&select=follower_id&limit=200`
    )
    if (!follows.ok || !Array.isArray(follows.data)) return { ok: false, error: "STORE_UNAVAILABLE" }
    const allowed = new Set(follows.data.map((row) => row.follower_id))
    return audience.every((userId) => allowed.has(userId)) ? { ok: true } : { ok: false, error: "SHARED_POST_PRIVATE" }
  }
  const mutualFollows = await rest<Array<{ follower_id: string; following_id: string }>>(
    `gh_follows?or=(and(follower_id.in.(${audienceIn}),following_id.eq.${encodeURIComponent(authorId)}),and(follower_id.eq.${encodeURIComponent(authorId)},following_id.in.(${audienceIn})))&select=follower_id,following_id&limit=400`
  )
  if (!mutualFollows.ok || !Array.isArray(mutualFollows.data)) return { ok: false, error: "STORE_UNAVAILABLE" }
  const followsAuthor = new Set(mutualFollows.data.filter((row) => row.following_id === authorId).map((row) => row.follower_id))
  const followedByAuthor = new Set(mutualFollows.data.filter((row) => row.follower_id === authorId).map((row) => row.following_id))
  return audience.every((userId) => followsAuthor.has(userId) && followedByAuthor.has(userId))
    ? { ok: true }
    : { ok: false, error: "SHARED_POST_PRIVATE" }
}

export async function appendMessage(input: {
  conversationId: string
  senderId: string
  body: string
  clientMessageId?: string | null
  replyToMessageId?: string | null
  sharedPostId?: string | null
  mediaAttachments?: DurableMediaAttachment[] | null
}): Promise<
  | { ok: true; message: DurableMessage; idempotent?: boolean }
  | { ok: false; error: string }
> {
  const cid = String(input.conversationId || "").trim()
  const uid = String(input.senderId || "").trim()
  const mediaAttachments = normalizeAttachments(input.mediaAttachments)
  let body = String(input.body || "").trim().slice(0, 8000)
  if (!body && mediaAttachments.length) {
    body = mediaPreviewLabel(mediaAttachments)
  }
  const clientMessageId = input.clientMessageId
    ? String(input.clientMessageId).trim().slice(0, 80)
    : null

  if (!body && !mediaAttachments.length) return { ok: false, error: "EMPTY_BODY" }
  if (input.mediaAttachments && Array.isArray(input.mediaAttachments) && input.mediaAttachments.length && !mediaAttachments.length) {
    return { ok: false, error: "INVALID_ATTACHMENTS" }
  }
  if (!(await isMember(cid, uid))) {
    // Heal incomplete community/group membership (creator or re-join after social create).
    if (dbConfigured()) {
      const convRow = await rest<Array<{ id: string; kind: string; created_by: string }>>(
        `gh_conversations?id=eq.${encodeURIComponent(cid)}&select=id,kind,created_by&limit=1`
      )
      const row = convRow.ok && Array.isArray(convRow.data) ? convRow.data[0] : null
      const kind = String(row?.kind || "")
      const isGroupish =
        kind === "community" ||
        kind === "group" ||
        !row ||
        cid.startsWith("comm_") ||
        cid.startsWith("community") ||
        cid.startsWith("group_")
      if (isGroupish) {
        // Always try to attach the sender; ensureCommunity* is idempotent.
        await ensureCommunityConversation({
          communityId: cid,
          ownerId: String(row?.created_by || uid),
        })
        await ensureCommunityMember({ communityId: cid, userId: uid, role: "member" })
      }
    } else {
      // In-memory store (non-prod): add sender so local tests work.
      await ensureCommunityMember({ communityId: cid, userId: uid, role: "member" })
    }
    if (!(await isMember(cid, uid))) return { ok: false, error: "FORBIDDEN" }
  }

  // Idempotent replay must return an already-persisted message even if privacy changed
  // between the original send and the client's retry; this never creates a new message.
  if (clientMessageId && dbConfigured()) {
    const q = `gh_messages?conversation_id=eq.${encodeURIComponent(cid)}&sender_id=eq.${encodeURIComponent(uid)}&client_message_id=eq.${encodeURIComponent(clientMessageId)}&select=*&limit=1`
    const existing = await rest<Array<Record<string, unknown>>>(q)
    if (existing.ok && existing.data?.[0]) {
      return { ok: true, message: rowToMessage(existing.data[0]), idempotent: true }
    }
  }

  if (cid.startsWith("dm_")) {
    const peerId = (await listMemberIds(cid)).find((memberId) => memberId !== uid)
    if (!peerId) return { ok: false, error: "FORBIDDEN" }
    const permission = await canReceiveDirectMessage(uid, peerId)
    if (!permission.allowed) return { ok: false, error: permission.error }
  }

  const sharedPostId = String(input.sharedPostId || "").trim().slice(0, 180)
  if (sharedPostId) {
    if (/[\u0000-\u001f\u007f]/.test(sharedPostId)) return { ok: false, error: "INVALID_SHARED_POST" }
    const sharePermission = await validateSharedPostForConversation({ senderId: uid, conversationId: cid, postId: sharedPostId })
    if (!sharePermission.ok) return { ok: false, error: sharePermission.error }
  }

  const replyToMessageId = String(input.replyToMessageId || "").trim().slice(0, 180)
  let replyToPreview: { senderName: string; text: string } | undefined
  if (replyToMessageId) {
    let parent: { sender_id?: string; body?: string; deleted_at?: string | null } | null = null
    if (dbConfigured()) {
      const q = `gh_messages?id=eq.${encodeURIComponent(replyToMessageId)}&conversation_id=eq.${encodeURIComponent(cid)}&deleted_at=is.null&select=sender_id,body,deleted_at&limit=1`
      const lookup = await rest<Array<Record<string, unknown>>>(q)
      if (!lookup.ok) return { ok: false, error: "STORE_UNAVAILABLE" }
      const row = lookup.data?.[0]
      if (row) parent = { sender_id: String(row.sender_id || ""), body: String(row.body || ""), deleted_at: row.deleted_at as string | null | undefined }
    } else {
      const row = (memMessages.get(cid) || []).find((m) => m.id === replyToMessageId && !m.deletedAt)
      if (row) parent = { sender_id: row.senderId, body: row.body }
    }
    if (!parent || parent.deleted_at) return { ok: false, error: "REPLY_TARGET_NOT_FOUND" }
    replyToPreview = {
      senderName: parent.sender_id === uid ? "Your message" : "Original message",
      text: String(parent.body || "").replace(/\s+/g, " ").trim().slice(0, 160),
    }
  }

  const t = Date.now()
  const msg: DurableMessage = {
    id: newId("msg"),
    conversationId: cid,
    senderId: uid,
    clientMessageId,
    body,
    status: "sent",
    createdAt: t,
    editedAt: null,
    deletedAt: null,
    deletedBy: null,
    replyTo: replyToMessageId || undefined,
    replyToPreview,
    mediaAttachments: mediaAttachments.length ? mediaAttachments : undefined,
      sharedPostId: sharedPostId || undefined,
  }

  if (dbConfigured()) {
    const ins = await rest<Array<Record<string, unknown>>>("gh_messages", {
      method: "POST",
      prefer: "return=representation",
      body: JSON.stringify({
        id: msg.id,
        conversation_id: cid,
        sender_id: uid,
        client_message_id: clientMessageId,
        body,
        status: "sent",
        created_at: new Date(t).toISOString(),
        meta: {
          ...(replyToMessageId ? { replyToMessageId, replyToPreview } : {}),
          ...(sharedPostId ? { sharedPostId } : {}),
          ...(mediaAttachments.length ? { attachments: mediaAttachments } : {}),
        },
      }),
    })
    if (!ins.ok) {
      // unique violation → fetch existing
      if (clientMessageId) {
        const q = `gh_messages?conversation_id=eq.${encodeURIComponent(cid)}&sender_id=eq.${encodeURIComponent(uid)}&client_message_id=eq.${encodeURIComponent(clientMessageId)}&select=*&limit=1`
        const existing = await rest<Array<Record<string, unknown>>>(q)
        if (existing.ok && existing.data?.[0]) {
          return {
            ok: true,
            message: rowToMessage(existing.data[0]),
            idempotent: true,
          }
        }
      }
      if (isProd()) return { ok: false, error: "PERSIST_FAILED" }
    } else if (ins.data?.[0]) {
      Object.assign(msg, rowToMessage(ins.data[0]))
    }
    await rest(
      `gh_conversations?id=eq.${encodeURIComponent(cid)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          updated_at: new Date(t).toISOString(),
          last_message_at: new Date(t).toISOString(),
          last_message_preview: previewOf(body),
        }),
      }
    )
    const recipients = (await listMemberIds(cid)).filter((memberId) => memberId !== uid)
    if (recipients.length) {
      await rest("gh_message_receipts", {
        method: "POST",
        prefer: "resolution=ignore-duplicates,return=minimal",
        body: JSON.stringify(recipients.map((recipientId) => ({
          message_id: msg.id,
          conversation_id: cid,
          sender_id: uid,
          recipient_id: recipientId,
        }))),
      })
    }
  } else if (isProd()) {
    return { ok: false, error: "STORE_UNAVAILABLE" }
  }

  const list = memMessages.get(cid) || []
  if (clientMessageId && list.some((m) => m.clientMessageId === clientMessageId)) {
    return {
      ok: true,
      message: list.find((m) => m.clientMessageId === clientMessageId)!,
      idempotent: true,
    }
  }
  list.push(msg)
  memMessages.set(cid, list)
  const conv = memConv.get(cid)
  if (conv) {
    memConv.set(cid, {
      ...conv,
      updatedAt: t,
      lastMessageAt: t,
      lastMessagePreview: previewOf(body),
    })
  }
  return { ok: true, message: msg }
}

export async function softDeleteMessage(input: {
  conversationId: string
  messageId: string
  actorId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const cid = String(input.conversationId || "").trim()
  const mid = String(input.messageId || "").trim()
  const uid = String(input.actorId || "").trim()
  if (!(await isMember(cid, uid))) return { ok: false, error: "FORBIDDEN" }

  if (dbConfigured()) {
    // Only sender can soft-delete own message (MVP)
    const q = `gh_messages?id=eq.${encodeURIComponent(mid)}&conversation_id=eq.${encodeURIComponent(cid)}&sender_id=eq.${encodeURIComponent(uid)}`
    const res = await rest(q, {
      method: "PATCH",
      body: JSON.stringify({
        status: "deleted",
        body: "",
        deleted_at: new Date().toISOString(),
        deleted_by: uid,
      }),
    })
    if (!res.ok && isProd()) return { ok: false, error: "DELETE_FAILED" }
    return { ok: true }
  }
  const list = memMessages.get(cid) || []
  const idx = list.findIndex((m) => m.id === mid && m.senderId === uid)
  if (idx < 0) return { ok: false, error: "NOT_FOUND" }
  list[idx] = {
    ...list[idx],
    status: "deleted",
    body: "",
    deletedAt: Date.now(),
    deletedBy: uid,
  }
  memMessages.set(cid, list)
  return { ok: true }
}


async function markMessagesDelivered(conversationId: string, recipientId: string, inbound: Array<{ id: string; senderId: string }>): Promise<boolean> {
  if (!dbConfigured() || !inbound.length) return false
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return false
  const senderById = new Map(inbound.map((row) => [row.id, row.senderId]))
  const ids = Array.from(new Set(inbound.map((row) => row.id).filter(Boolean))).slice(0, 100)
  const inList = ids.map((id) => encodeURIComponent(id)).join(",")
  const nowIso = new Date().toISOString()
  // Mark existing pending receipts first; never reset an existing read receipt.
  const patched = await rest(
    `gh_message_receipts?conversation_id=eq.${encodeURIComponent(conversationId)}&recipient_id=eq.${encodeURIComponent(recipientId)}&message_id=in.(${inList})&delivered_at=is.null`,
    { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ delivered_at: nowIso }) }
  )
  if (!patched.ok) return false
  const existing = await rest<Array<{ message_id: string }>>(
    `gh_message_receipts?conversation_id=eq.${encodeURIComponent(conversationId)}&recipient_id=eq.${encodeURIComponent(recipientId)}&message_id=in.(${inList})&select=message_id`
  )
  if (!existing.ok || !Array.isArray(existing.data)) return false
  const existingIds = new Set(existing.data.map((row) => row.message_id))
  const missing = ids.filter((id) => !existingIds.has(id))
  if (missing.length) {
    const inserted = await rest("gh_message_receipts", {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=minimal",
      body: JSON.stringify(missing.map((messageId) => ({ message_id: messageId, conversation_id: conversationId, sender_id: senderById.get(messageId) || "unknown", recipient_id: recipientId, delivered_at: nowIso }))),
    })
    if (!inserted.ok) return false
  }
  return true
}

export type ConversationPresence = { userId: string; online: boolean; lastSeenAt: number | null; isTyping: boolean }

/** Update the authenticated user's presence/typing heartbeat. Conversation membership is mandatory for typing. */
export async function touchMessagingPresence(input: { userId: string; conversationId?: string; action: "heartbeat" | "typing" | "stop_typing" }): Promise<{ ok: true; presence: ConversationPresence[]; durable: boolean } | { ok: false; error: string }> {
  const uid = String(input.userId || "").trim()
  const cid = String(input.conversationId || "").trim()
  if (!uid) return { ok: false, error: "INVALID_USER" }
  if (cid && !(await isMember(cid, uid))) return { ok: false, error: "FORBIDDEN" }
  if (input.action === "typing" && !cid) return { ok: false, error: "CONVERSATION_REQUIRED" }
  const peers = cid ? (await listMemberIds(cid)).filter((memberId) => memberId !== uid) : []
  let effectiveAction = input.action
  if (cid.startsWith("dm_")) {
    const peerId = peers[0]
    if (peerId && input.action === "typing") {
      const permission = await canReceiveDirectMessage(uid, peerId)
      // A peer's inbound-message restriction or this user's hidden presence must suppress typing,
      // but must not prevent the current client from refreshing the peer's own presence.
      if (!permission.allowed || !(await canViewMessagingPresence(peerId, uid))) effectiveAction = "stop_typing"
    }
  }
  const now = Date.now()
  const record: { user_id: string; last_seen_at: string; online_until: string; updated_at: string; typing_conversation_id?: string | null; typing_until?: string | null } = {
    user_id: uid,
    last_seen_at: new Date(now).toISOString(),
    online_until: new Date(now + 65_000).toISOString(),
    updated_at: new Date(now).toISOString(),
  }
  if (effectiveAction === "typing") {
    record.typing_conversation_id = cid
    record.typing_until = new Date(now + 8_000).toISOString()
  } else if (effectiveAction === "stop_typing") {
    record.typing_conversation_id = null
    record.typing_until = null
  }
  if (dbConfigured()) {
    const saved = await rest("gh_user_presence", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: JSON.stringify(record),
    })
    if (!saved.ok && isProd()) return { ok: false, error: "PRESENCE_UNAVAILABLE" }
  } else if (isProd()) {
    return { ok: false, error: "STORE_UNAVAILABLE" }
  }
  const previous = memPresence.get(uid)
  memPresence.set(uid, {
    lastSeenAt: now,
    onlineUntil: now + 65_000,
    typingConversationId: effectiveAction === "typing" ? cid : effectiveAction === "stop_typing" ? undefined : previous?.typingConversationId,
    typingUntil: effectiveAction === "typing" ? now + 8_000 : effectiveAction === "stop_typing" ? undefined : previous?.typingUntil,
  })
  const presence = await getConversationPresence({ conversationId: cid, userId: uid })
  return { ok: true, presence, durable: dbConfigured() }
}

/** Only active members of the same conversation can inspect each other's presence. */
export async function getConversationPresence(input: { conversationId: string; userId: string }): Promise<ConversationPresence[]> {
  const cid = String(input.conversationId || "").trim()
  const uid = String(input.userId || "").trim()
  if (!cid || !uid || !(await isMember(cid, uid))) return []
  const now = Date.now()
  const peers = (await listMemberIds(cid)).filter((memberId) => memberId !== uid).slice(0, 100)
  const visibleSet = await getVisiblePresencePeerIds(uid, peers)
  const visiblePeers = peers.filter((peerId) => visibleSet.has(peerId))
  const records = new Map<string, { last_seen_at?: string; online_until?: string; typing_conversation_id?: string | null; typing_until?: string | null }>()
  if (dbConfigured() && visiblePeers.length) {
    const inList = visiblePeers.map((peerId) => encodeURIComponent(peerId)).join(",")
    const found = await rest<Array<{ user_id: string; last_seen_at: string; online_until: string; typing_conversation_id: string | null; typing_until: string | null }>>(
      `gh_user_presence?user_id=in.(${inList})&select=user_id,last_seen_at,online_until,typing_conversation_id,typing_until`
    )
    if (found.ok && Array.isArray(found.data)) {
      for (const row of found.data) records.set(row.user_id, row)
    }
  }
  return visiblePeers.map((peerId) => {
    const row = records.get(peerId)
    const local = dbConfigured() ? undefined : memPresence.get(peerId)
    const lastSeenAt = row?.last_seen_at ? Date.parse(row.last_seen_at) : local?.lastSeenAt ?? null
    const onlineUntil = row?.online_until ? Date.parse(row.online_until) : local?.onlineUntil ?? 0
    const typingUntil = row ? (row.typing_until ? Date.parse(row.typing_until) : 0) : local?.typingUntil ?? 0
    const typingConversationId = row ? row.typing_conversation_id : local?.typingConversationId
    return {
      userId: peerId,
      online: onlineUntil > now,
      lastSeenAt: Number.isFinite(lastSeenAt as number) ? lastSeenAt : null,
      isTyping: typingConversationId === cid && Number(typingUntil) > now,
    }
  })
}

/** Update last_read_at for the authenticated member only. */
export async function markConversationRead(input: {
  conversationId: string
  ghUserId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const cid = String(input.conversationId || "").trim()
  const uid = String(input.ghUserId || "").trim()
  if (!cid || !uid) return { ok: false, error: "INVALID" }
  if (!(await isMember(cid, uid))) return { ok: false, error: "FORBIDDEN" }

  if (dbConfigured()) {
    const marked = await rest<boolean>("rpc/gh_messaging_mark_read", {
      method: "POST",
      body: JSON.stringify({ p_user_id: uid, p_conversation_id: cid }),
    })
    if ((!marked.ok || marked.data !== true) && isProd()) return { ok: false, error: "RECEIPT_UPDATE_FAILED" }
  } else if (isProd()) {
    return { ok: false, error: "STORE_UNAVAILABLE" }
  }
  return { ok: true }
}

/**
 * Edit own message body. Durable when DB configured (requires migration 55 RPCs
 * or direct PATCH). Sender + membership enforced.
 */
export async function editMessage(input: {
  conversationId: string
  messageId: string
  actorId: string
  body: string
}): Promise<
  | { ok: true; message: DurableMessage; durable: boolean }
  | { ok: false; error: string }
> {
  const cid = String(input.conversationId || "").trim()
  const mid = String(input.messageId || "").trim()
  const uid = String(input.actorId || "").trim()
  const body = String(input.body || "").trim().slice(0, 8000)
  if (!body) return { ok: false, error: "EMPTY_BODY" }
  if (!(await isMember(cid, uid))) return { ok: false, error: "FORBIDDEN" }

  if (dbConfigured()) {
    const env = readGhcServerEnv()
    if (env.supabaseUrl && env.supabaseServiceRoleKey) {
      // Prefer RPC when migration 55 applied
      try {
        const rpcRes = await fetch(
          `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_edit_message`,
          {
            method: "POST",
            headers: {
              apikey: env.supabaseServiceRoleKey,
              Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify({
              p_message_id: mid,
              p_actor_id: uid,
              p_body: body,
            }),
            cache: "no-store",
          }
        )
        const rpcData = (await rpcRes.json().catch(() => null)) as {
          ok?: boolean
          error?: string
          body?: string
          edited_at?: string
        } | null
        if (rpcRes.ok && rpcData && rpcData.ok === true) {
          const q = `gh_messages?id=eq.${encodeURIComponent(mid)}&select=*&limit=1`
          const fetched = await rest<Array<Record<string, unknown>>>(q)
          if (fetched.ok && fetched.data?.[0]) {
            return { ok: true, message: rowToMessage(fetched.data[0]), durable: true }
          }
          return {
            ok: true,
            durable: true,
            message: {
              id: mid,
              conversationId: cid,
              senderId: uid,
              clientMessageId: null,
              body: String(rpcData.body || body),
              status: "sent",
              createdAt: Date.now(),
              editedAt: rpcData.edited_at
                ? Date.parse(String(rpcData.edited_at))
                : Date.now(),
              deletedAt: null,
              deletedBy: null,
            },
          }
        }
        if (rpcData && rpcData.ok === false) {
          return { ok: false, error: String(rpcData.error || "EDIT_FAILED") }
        }
      } catch {
        /* fall through to PATCH */
      }
    }
    // Fallback PATCH: ownership enforced by sender_id filter
    const patch = await rest(
      `gh_messages?id=eq.${encodeURIComponent(mid)}&conversation_id=eq.${encodeURIComponent(cid)}&sender_id=eq.${encodeURIComponent(uid)}&deleted_at=is.null`,
      {
        method: "PATCH",
        prefer: "return=representation",
        body: JSON.stringify({
          body,
          edited_at: new Date().toISOString(),
        }),
      }
    )
    if (patch.ok && Array.isArray(patch.data) && (patch.data as unknown[])[0]) {
      return {
        ok: true,
        durable: true,
        message: rowToMessage((patch.data as Array<Record<string, unknown>>)[0]),
      }
    }
    if (isProd()) return { ok: false, error: "EDIT_FAILED" }
  }

  const list = memMessages.get(cid) || []
  const idx = list.findIndex((m) => m.id === mid && m.senderId === uid)
  if (idx < 0) return { ok: false, error: "NOT_FOUND" }
  if (list[idx].deletedAt) return { ok: false, error: "DELETED" }
  list[idx] = { ...list[idx], body, editedAt: Date.now() }
  memMessages.set(cid, list)
  if (isProd()) return { ok: false, error: "STORE_UNAVAILABLE" }
  return { ok: true, message: list[idx], durable: false }
}

/** Pin / unpin a message within a conversation (member only). */
export async function pinMessage(input: {
  conversationId: string
  messageId: string
  actorId: string
  pinned: boolean
}): Promise<{ ok: true; durable: boolean } | { ok: false; error: string }> {
  const cid = String(input.conversationId || "").trim()
  const mid = String(input.messageId || "").trim()
  const uid = String(input.actorId || "").trim()
  if (!(await isMember(cid, uid))) return { ok: false, error: "FORBIDDEN" }

  if (dbConfigured()) {
    const env = readGhcServerEnv()
    if (env.supabaseUrl && env.supabaseServiceRoleKey) {
      try {
        const rpcRes = await fetch(
          `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_pin_message`,
          {
            method: "POST",
            headers: {
              apikey: env.supabaseServiceRoleKey,
              Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              p_message_id: mid,
              p_actor_id: uid,
              p_pinned: Boolean(input.pinned),
            }),
            cache: "no-store",
          }
        )
        const rpcData = (await rpcRes.json().catch(() => null)) as {
          ok?: boolean
          error?: string
        } | null
        if (rpcRes.ok && rpcData?.ok === true) return { ok: true, durable: true }
        if (rpcData?.ok === false) return { ok: false, error: String(rpcData.error || "PIN_FAILED") }
      } catch {
        /* fall through */
      }
    }
    const patch = await rest(
      `gh_messages?id=eq.${encodeURIComponent(mid)}&conversation_id=eq.${encodeURIComponent(cid)}&deleted_at=is.null`,
      {
        method: "PATCH",
        body: JSON.stringify({ is_pinned: Boolean(input.pinned) }),
      }
    )
    if (patch.ok) return { ok: true, durable: true }
    if (isProd()) return { ok: false, error: "PIN_FAILED" }
  }

  const list = memMessages.get(cid) || []
  const idx = list.findIndex((m) => m.id === mid)
  if (idx < 0) return { ok: false, error: "NOT_FOUND" }
  list[idx] = { ...list[idx], isPinned: Boolean(input.pinned) }
  memMessages.set(cid, list)
  if (isProd()) return { ok: false, error: "STORE_UNAVAILABLE" }
  return { ok: true, durable: false }
}

/** Personal conversation preferences (pin/archive/mute) — never global. */
export async function setConversationPrefs(input: {
  conversationId: string
  ghUserId: string
  isPinned?: boolean
  isArchived?: boolean
  mutedUntil?: number | null
}): Promise<{ ok: true; durable: boolean } | { ok: false; error: string }> {
  const cid = String(input.conversationId || "").trim()
  const uid = String(input.ghUserId || "").trim()
  if (!cid || !uid) return { ok: false, error: "INVALID" }
  if (!(await isMember(cid, uid))) return { ok: false, error: "FORBIDDEN" }

  if (dbConfigured()) {
    const env = readGhcServerEnv()
    if (env.supabaseUrl && env.supabaseServiceRoleKey) {
      try {
        const rpcRes = await fetch(
          `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_set_conversation_prefs`,
          {
            method: "POST",
            headers: {
              apikey: env.supabaseServiceRoleKey,
              Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              p_conversation_id: cid,
              p_actor_id: uid,
              p_is_pinned: input.isPinned ?? null,
              p_is_archived: input.isArchived ?? null,
              p_muted_until:
                input.mutedUntil != null
                  ? new Date(input.mutedUntil).toISOString()
                  : null,
              p_clear_mute: input.mutedUntil === null,
            }),
            cache: "no-store",
          }
        )
        const rpcData = (await rpcRes.json().catch(() => null)) as {
          ok?: boolean
          error?: string
        } | null
        if (rpcRes.ok && rpcData?.ok === true) return { ok: true, durable: true }
        if (rpcData?.ok === false) {
          return { ok: false, error: String(rpcData.error || "PREFS_FAILED") }
        }
      } catch {
        /* fall through */
      }
    }
    const patchBody: Record<string, unknown> = {}
    if (typeof input.isPinned === "boolean") patchBody.is_pinned = input.isPinned
    if (typeof input.isArchived === "boolean") patchBody.is_archived = input.isArchived
    if (input.mutedUntil === null) patchBody.muted_until = null
    else if (typeof input.mutedUntil === "number") {
      patchBody.muted_until = new Date(input.mutedUntil).toISOString()
    }
    if (Object.keys(patchBody).length) {
      const patch = await rest(
        `gh_conversation_members?conversation_id=eq.${encodeURIComponent(cid)}&gh_user_id=eq.${encodeURIComponent(uid)}`,
        { method: "PATCH", body: JSON.stringify(patchBody) }
      )
      if (patch.ok) return { ok: true, durable: true }
      if (isProd()) return { ok: false, error: "PREFS_FAILED" }
    }
  }
  if (isProd()) return { ok: false, error: "STORE_UNAVAILABLE" }
  return { ok: true, durable: false }
}

/** True if either direction has a block row. */
export async function areUsersBlocked(a: string, b: string): Promise<boolean> {
  const x = String(a || "").trim()
  const y = String(b || "").trim()
  if (!x || !y || x === y) return false
  if (!dbConfigured()) return false
  const q =
    `ghc_user_blocks?or=(and(blocker_id.eq.${encodeURIComponent(x)},blocked_id.eq.${encodeURIComponent(y)}),` +
    `and(blocker_id.eq.${encodeURIComponent(y)},blocked_id.eq.${encodeURIComponent(x)}))&select=blocker_id&limit=1`
  const { ok, data } = await rest<Array<unknown>>(q)
  // Fail closed when the block service is unavailable; do not permit a DM send
  // merely because a privacy check timed out.
  if (!ok || !Array.isArray(data)) return true
  return data.length > 0
}
