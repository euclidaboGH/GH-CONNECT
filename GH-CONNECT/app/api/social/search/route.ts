/**
 * GET /api/social/search?q=&category=&limit=
 * Server-authoritative discovery. No ranking scores, no economy mutation.
 * Categories: all | people | posts | videos | creators
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { socialDbConfigured, socialRpc } from "@/lib/server/social/rpc"
import { hydratePublicProfileIdentity } from "@/lib/server/identity/public-profile-hydration"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CATEGORIES = new Set(["all", "people", "posts", "videos", "creators"])

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }

  const rl = checkRateLimit(`search:${auth.userId}`, 60, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 })
  }

  const url = new URL(request.url)
  const q = String(url.searchParams.get("q") || "").trim().slice(0, 80)
  const categoryRaw = String(url.searchParams.get("category") || "all").toLowerCase()
  const category = CATEGORIES.has(categoryRaw) ? categoryRaw : "all"
  const limit = Math.min(40, Math.max(1, Number(url.searchParams.get("limit") || 20) || 20))

  // Ignore client ranking / scores / userId overrides
  void url.searchParams.get("userId")
  void url.searchParams.get("rank")
  void url.searchParams.get("score")

  if (q.length < 2) {
    return NextResponse.json({
      ok: true,
      durable: socialDbConfigured(),
      query: q,
      category,
      people: [],
      posts: [],
      videos: [],
      creators: [],
      ranking: "none",
    })
  }

  if (!socialDbConfigured()) {
    return NextResponse.json({
      ok: true,
      durable: false,
      query: q,
      category,
      people: [],
      posts: [],
      videos: [],
      creators: [],
      ranking: "none",
      message: "SOCIAL_DB_UNAVAILABLE — client may fall back to local discovery",
    })
  }

  const actor = auth.userId
  const empty = { people: [] as unknown[], posts: [] as unknown[], videos: [] as unknown[], creators: [] as unknown[] }

  const wantPeople = category === "all" || category === "people"
  const wantPosts = category === "all" || category === "posts"
  const wantVideos = category === "all" || category === "videos"
  const wantCreators = category === "all" || category === "creators"

  const [peopleRes, postsRes, videosRes, creatorsRes] = await Promise.all([
    wantPeople
      ? socialRpc("gh_search_people", { p_actor_id: actor, p_query: q, p_limit: limit })
      : Promise.resolve({ ok: true, data: { people: [] } }),
    wantPosts
      ? socialRpc("gh_search_posts", {
          p_actor_id: actor,
          p_query: q,
          p_limit: limit,
          p_video_only: false,
        })
      : Promise.resolve({ ok: true, data: { posts: [] } }),
    wantVideos
      ? socialRpc("gh_search_posts", {
          p_actor_id: actor,
          p_query: q,
          p_limit: limit,
          p_video_only: true,
        })
      : Promise.resolve({ ok: true, data: { posts: [] } }),
    wantCreators
      ? socialRpc("gh_search_creators", { p_actor_id: actor, p_query: q, p_limit: limit })
      : Promise.resolve({ ok: true, data: { creators: [] } }),
  ])

  const people =
    wantPeople && peopleRes.ok && peopleRes.data
      ? ((peopleRes.data as { people?: unknown[] }).people || [])
      : empty.people
  const posts =
    wantPosts && postsRes.ok && postsRes.data
      ? ((postsRes.data as { posts?: unknown[] }).posts || [])
      : empty.posts
  const videos =
    wantVideos && videosRes.ok && videosRes.data
      ? ((videosRes.data as { posts?: unknown[] }).posts || [])
      : empty.videos
  const creators =
    wantCreators && creatorsRes.ok && creatorsRes.data
      ? ((creatorsRes.data as { creators?: unknown[] }).creators || [])
      : empty.creators

  // Search and feed now share the same canonical public identity source.
  // Hydration only updates public display-name/photo aliases; it never changes ranking,
  // access checks, authorship, or economy data.
  const [hydratedPeople, hydratedPosts, hydratedVideos, hydratedCreators] = await Promise.all([
    hydratePublicProfileIdentity(Array.isArray(people) ? people.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : []),
    hydratePublicProfileIdentity(Array.isArray(posts) ? posts.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : []),
    hydratePublicProfileIdentity(Array.isArray(videos) ? videos.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : []),
    hydratePublicProfileIdentity(Array.isArray(creators) ? creators.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : []),
  ])

  return NextResponse.json({
    ok: true,
    durable: true,
    query: q,
    category,
    people: hydratedPeople,
    posts: hydratedPosts,
    videos: hydratedVideos,
    creators: hydratedCreators,
    ranking: "chronological",
  }, { headers: { "Cache-Control": "no-store" } })
}
