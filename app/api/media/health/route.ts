/**
 * GET /api/media/health — operator/diagnostic check for media pipeline.
 * Does not expose secrets. Reports whether storage + auth path are available.
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
        }
      }
    } catch {
      bucketReachable = false
      bucketError = "NETWORK"
    }
  }

  return NextResponse.json(
    {
      ok: true,
      authenticated: Boolean(auth),
      userIdPresent: Boolean(auth?.userId),
      storageConfigured: hasUrl && hasKey,
      bucket: storageBucket,
      bucketReachable,
      bucketError,
      bucketEnsured,
      limits: {
        proxyMaxMb: 4,
        imageMaxMb: 25,
        videoMaxMb: 80,
        fileMaxMb: 25,
        directUpload: true,
      },
      routes: {
        proxy: "/api/media",
        directIntent: "/api/media/direct-upload-intent",
        directComplete: "/api/media/direct-upload-complete",
      },
      hint: !auth
        ? "Open this URL while signed in. If authenticated is false, session/cookies are the first problem."
        : !hasUrl || !hasKey
          ? "Supabase URL or service role key missing in Vercel env."
          : bucketReachable === false
            ? "Storage bucket not reachable — check GH_MEDIA_BUCKET and Supabase storage policies."
            : "Media pipeline configuration looks reachable. Retry an upload and check Vercel logs if it still fails.",
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
