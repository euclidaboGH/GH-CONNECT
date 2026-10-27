/**
 * GET /api/media/health — operator/diagnostic check for media pipeline.
 * Does not expose secrets. Reports storage + private-bucket readiness.
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { ensureMediaBucket } from "@/lib/server/media/ensure-bucket"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  const env = readGhcServerEnv()
  const storageBucket = String(process.env.GH_MEDIA_BUCKET || "gh-media").trim() || "gh-media"
  const hasUrl = Boolean(env.supabaseUrl)
  const hasKey = Boolean(env.supabaseServiceRoleKey)

  let bucketReachable: boolean | null = null
  let bucketError: string | null = null
  let bucketEnsured: boolean | null = null
  let bucketPublic: boolean | null = null
  let fileSizeLimit: number | null = null

  if (hasUrl && hasKey) {
    try {
      const ensured = await ensureMediaBucket(storageBucket)
      bucketEnsured = ensured.ok
      if (!ensured.ok) {
        bucketReachable = false
        bucketError = ensured.error || "ENSURE_FAILED"
      } else {
        const res = await fetch(
          `${env.supabaseUrl!.replace(/\/$/, "")}/storage/v1/bucket/${encodeURIComponent(storageBucket)}`,
          {
            headers: {
              Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
              apikey: env.supabaseServiceRoleKey!,
            },
            cache: "no-store",
          }
        )
        bucketReachable = res.ok
        if (!res.ok) {
          bucketError = `HTTP_${res.status}`
        } else {
          const info = (await res.json().catch(() => null)) as {
            public?: boolean
            file_size_limit?: number
          } | null
          if (info) {
            bucketPublic = Boolean(info.public)
            fileSizeLimit = typeof info.file_size_limit === "number" ? info.file_size_limit : null
          }
        }
      }
    } catch {
      bucketReachable = false
      bucketError = "NETWORK"
    }
  }


  // Optional operator probe: /api/media/health?probeMediaId=media_xxx
  // Signs one known asset so we surface real storage sign errors (not just bucket list).
  let signProbe: {
    attempted: boolean
    ok: boolean
    error?: string
    detail?: string
    status?: number
  } = { attempted: false, ok: false }
  try {
    const probeId = new URL(request.url).searchParams.get("probeMediaId")?.trim() || ""
    if (probeId && /^media_[a-z0-9]+_[a-z0-9]+$/i.test(probeId) && auth && hasUrl && hasKey) {
      signProbe.attempted = true
      const origin = new URL(request.url).origin
      const res = await fetch(`${origin}/api/media/${encodeURIComponent(probeId)}/signed-url`, {
        method: "GET",
        headers: {
          ...(request.headers.get("cookie") ? { cookie: request.headers.get("cookie")! } : {}),
          ...(request.headers.get("authorization") ? { authorization: request.headers.get("authorization")! } : {}),
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      })
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        detail?: string
        status?: number
        url?: string
      } | null
      signProbe.status = res.status
      if (res.ok && body?.ok === true && typeof body.url === "string") {
        signProbe.ok = true
      } else {
        signProbe.error = body?.error || `HTTP_${res.status}`
        signProbe.detail = typeof body?.detail === "string" ? body.detail.slice(0, 180) : undefined
      }
    }
  } catch {
    signProbe = { attempted: true, ok: false, error: "PROBE_EXCEPTION" }
  }

  const ready =
    Boolean(auth) && hasUrl && hasKey && bucketReachable === true && bucketEnsured !== false

  return NextResponse.json(
    {
      ok: true,
      ready,
      authenticated: Boolean(auth),
      userIdPresent: Boolean(auth?.userId),
      storageConfigured: hasUrl && hasKey,
      bucket: storageBucket,
      bucketReachable,
      bucketError,
      bucketEnsured,
      /** Operator expects private=true for GreenHaven. Public buckets still work via signed facade. */
      bucketPublic,
      fileSizeLimitBytes: fileSizeLimit,
      signProbe,
      privacy: "private-bucket-via-authorized-facade",
      folders: ["avatars", "images", "videos", "audio", "documents"],
      pathPattern: "{ownerUserId}/{folder}/{uuid}.{ext}",
      limits: {
        proxyMaxMb: 4,
        imageMaxMb: 50,
        videoMaxMb: 50,
        audioMaxMb: 50,
        fileMaxMb: 50,
        bucketMaxMb: 50,
        directUpload: true,
      },
      routes: {
        proxy: "/api/media",
        directIntent: "/api/media/direct-upload-intent",
        directComplete: "/api/media/direct-upload-complete",
        content: "/api/media/{id}/content",
        signedUrl: "/api/media/{id}/signed-url",
        health: "/api/media/health",
      },
      migrationsRequired: [
        "20261022010049_gh_media_assets.sql",
        "20261022010087_gh_private_media_references_and_viewer_authz.sql",
        "20261022010089_gh_comment_media_attachments.sql",
      ],
      hint: !auth
        ? "Open while signed in. If authenticated is false, session/cookies are the first problem."
        : !hasUrl || !hasKey
          ? "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel (server secrets), plus GH_MEDIA_BUCKET."
          : bucketReachable !== true
            ? "Bucket not reachable — create private bucket matching GH_MEDIA_BUCKET and apply media migrations."
            : ready
              ? "Media pipeline looks ready. Uploads use owner folders; display uses /api/media/{id}/content (auth required)."
              : "Check migrations and bucket privacy settings.",
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
