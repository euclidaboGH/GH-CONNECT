"use client"

import { useEffect, useState } from "react"
import { ExternalLink, FileText, Image as ImageIcon, Loader2 } from "lucide-react"
import { LazyImage } from "./lazy-image"
import { isDurableMediaUrl } from "@/lib/media/durable-url"

type QuotedPost = {
  id: string
  authorName?: string
  authorPhoto?: string
  content?: string
  images?: unknown
  video?: string | null
  pdf?: string | null
  visibility?: string
}

type Props = { postId: string }

/** Viewer-authorized compact preview. The post API enforces visibility before returning content. */
export function QuotedPostPreview({ postId }: Props) {
  const [post, setPost] = useState<QuotedPost | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading")
  const [retryVersion, setRetryVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setPost(null)
    setStatus("loading")
    if (!postId || !/^[a-zA-Z0-9_-]{1,180}$/.test(postId)) {
      setStatus("unavailable")
      return () => controller.abort()
    }
    void fetch(`/api/social/posts/${encodeURIComponent(postId)}`, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("POST_UNAVAILABLE")
      const payload = await response.json() as { ok?: boolean; post?: QuotedPost | null }
      if (controller.signal.aborted) return
      if (!payload.ok || !payload.post || payload.post.id !== postId) throw new Error("POST_UNAVAILABLE")
      setPost(payload.post)
      setStatus("ready")
    }).catch((error: unknown) => {
      if (error instanceof Error && error.name === "AbortError") return
      setPost(null)
      setStatus("unavailable")
    })
    return () => controller.abort()
  }, [postId, retryVersion])

  const openOriginal = () => {
    if (!postId) return
    window.dispatchEvent(new CustomEvent("ghc:open-post", { detail: { postId, action: "view", source: "quoted-post" } }))
  }

  const images = Array.isArray(post?.images)
    ? post.images.filter((value): value is string => typeof value === "string" && isDurableMediaUrl(value))
    : []

  return (
    <section className="gh-quoted-post" data-post-no-open aria-label="Quoted post">
      {status === "loading" ? (
        <div className="flex min-h-16 items-center gap-2 px-3 py-3 text-sm text-muted-foreground" role="status">
          <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          <span>Loading original post…</span>
        </div>
      ) : status === "unavailable" || !post ? (
        <div className="flex flex-wrap items-center gap-2 px-3 py-3 text-sm text-muted-foreground" role="status" aria-live="polite">
          <FileText size={16} aria-hidden="true" />
          <span className="min-w-0 flex-1">This original post is unavailable or you don’t have permission to view it.</span>
          <button type="button" onClick={() => setRetryVersion((version) => version + 1)} className="min-h-9 rounded-full px-3 font-semibold text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">Try again</button>
        </div>
      ) : (
        <button type="button" onClick={openOriginal} className="block w-full rounded-[inherit] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" aria-label={`Open original post by ${post.authorName || "Member"}`}>
          <div className="flex items-center justify-between gap-2 px-3 pt-3">
            <span className="truncate text-xs font-semibold text-foreground">{post.authorName?.trim() || "Member"}</span>
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground"><ExternalLink size={12} aria-hidden="true" /> Original post</span>
          </div>
          {post.content?.trim() ? <p className="px-3 pb-2 pt-1 text-sm leading-6 text-foreground/90 [overflow-wrap:anywhere] line-clamp-4">{post.content}</p> : null}
          {images[0] ? (
            <div className="relative mx-3 mb-3 overflow-hidden rounded-lg bg-muted">
              <LazyImage src={images[0]} alt="Media from original post" className="max-h-56 w-full object-cover" sizes="(max-width: 640px) 85vw, 600px" variant="post-media" />
              {images.length > 1 ? <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-medium text-white"><ImageIcon size={11} className="mr-1 inline" aria-hidden="true" />+{images.length - 1} photos</span> : null}
            </div>
          ) : post.video && isDurableMediaUrl(post.video) ? (
            <div className="mx-3 mb-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Video attached to original post</div>
          ) : post.pdf ? (
            <div className="mx-3 mb-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Document attached to original post</div>
          ) : null}
        </button>
      )}
    </section>
  )
}
