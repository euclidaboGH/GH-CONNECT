/**
 * Community feed — unified timeline of existing domain objects.
 * Does not invent posts/events; preserves original identity.
 */

export type CommunityFeedItemKind =
  | "discussion"
  | "announcement"
  | "event"
  | "activity"
  | "resource"

export interface CommunityFeedItem {
  id: string
  kind: CommunityFeedItemKind
  communityId: string
  title?: string
  body?: string
  authorId?: string
  authorName?: string
  createdAt: number
  /** Original object for open/participation actions */
  source: unknown
}

export interface CommunityFeedSources {
  communityId: string
  boardPosts?: Array<{
    id: string
    authorId?: string
    authorName?: string
    body?: string
    kind?: string
    createdAt?: number
  }>
  announcements?: Array<{
    id: string
    title?: string
    content?: string
    body?: string
    createdAt?: number
    pinned?: boolean
  }>
  events?: Array<{
    id: string
    title?: string
    startsAt?: number
    startAt?: number
    date?: number
    description?: string
  }>
  activities?: Array<{
    id?: string
    title?: string
    name?: string
    createdAt?: number
  }>
  resources?: Array<{
    id?: string
    title?: string
    description?: string
    addedAt?: number
  }>
}

/**
 * Build a single feed sorted by time (newest first).
 * Only includes objects present in sources — never fabricates rows.
 */
export function buildCommunityFeed(sources: CommunityFeedSources): CommunityFeedItem[] {
  const items: CommunityFeedItem[] = []
  const cid = sources.communityId

  for (const p of sources.boardPosts || []) {
    if (!p?.id) continue
    items.push({
      id: p.id,
      kind: "discussion",
      communityId: cid,
      body: p.body,
      authorId: p.authorId,
      authorName: p.authorName,
      createdAt: Number(p.createdAt) || 0,
      source: p,
    })
  }

  for (const a of sources.announcements || []) {
    if (!a?.id) continue
    items.push({
      id: a.id,
      kind: "announcement",
      communityId: cid,
      title: a.title,
      body: a.content || a.body,
      createdAt: Number(a.createdAt) || 0,
      source: a,
    })
  }

  for (const e of sources.events || []) {
    if (!e?.id) continue
    const t = Number(e.startsAt || e.startAt || e.date) || 0
    items.push({
      id: e.id,
      kind: "event",
      communityId: cid,
      title: e.title,
      body: e.description,
      createdAt: t,
      source: e,
    })
  }

  for (const act of sources.activities || []) {
    const id = act.id || act.title || act.name
    if (!id) continue
    items.push({
      id: String(id),
      kind: "activity",
      communityId: cid,
      title: act.title || act.name,
      createdAt: Number(act.createdAt) || 0,
      source: act,
    })
  }

  for (const r of sources.resources || []) {
    const id = r.id || r.title
    if (!id) continue
    items.push({
      id: String(id),
      kind: "resource",
      communityId: cid,
      title: r.title,
      body: r.description,
      createdAt: Number(r.addedAt) || 0,
      source: r,
    })
  }

  return items.sort((a, b) => b.createdAt - a.createdAt)
}
