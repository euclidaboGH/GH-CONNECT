"use client"

import { useEffect, useMemo, useState } from "react"
import { X, MessageCircle, Share2, Clock3, LoaderCircle, Image as ImageIcon } from "lucide-react"
import type { Post } from "@/lib/ghc-types"
import { timeAgo } from "@/lib/ghc-data"
import { LazyImage } from "./lazy-image"

const REACTION_EMOJI: Record<string, string> = {
  like: "❤️", love: "😍", support: "💪", inspire: "✨", insight: "💡", celebrate: "🎉",
  laugh: "😂", fire: "🔥", clap: "👏", wow: "😮", sad: "😢",
}

export function PostDetailSheet({
  post,
  open,
  onClose,
  onComments,
  onShare,
  onOpenMedia,
  loadComments,
}: {
  post: Post | null
  open: boolean
  onClose: () => void
  onComments: (postId: string) => void
  onShare: (postId: string) => void
  onOpenMedia?: (url: string, caption?: string) => void
  loadComments?: (postId: string) => Promise<unknown>
}) {
  const [loadingComments, setLoadingComments] = useState(false)
  const [mediaIndex, setMediaIndex] = useState(0)
  const media = useMemo(() => (Array.isArray(post?.images) ? post.images.filter((url) => typeof url === "string" && url.trim() && !url.includes("placeholder")) : []), [post?.images])
  const comments = Array.isArray(post?.comments) ? post.comments : []
  const commentCount = Number(post?.engagement?.comments ?? post?.comments?.length ?? 0) || 0
  const likes = Number(post?.engagement?.likes ?? post?.likes ?? 0) || 0
  const shares = Number(post?.engagement?.shares ?? post?.shares ?? 0) || 0
  const reactionEntries = Object.entries(post?.reactionCounts || {}).filter(([, count]) => Number(count) > 0).sort((a, b) => Number(b[1]) - Number(a[1]))

  useEffect(() => {
    setMediaIndex(0)
  }, [post?.id])

  useEffect(() => {
    if (!open || !post?.id || !loadComments) return
    let cancelled = false
    setLoadingComments(true)
    void loadComments(post.id).finally(() => { if (!cancelled) setLoadingComments(false) })
    return () => { cancelled = true }
  }, [open, post?.id, loadComments])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  if (!open || !post) return null

  return (
    <div className="fixed inset-0 z-[84] flex items-end justify-center bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Full post by ${post.authorName}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="relative flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-border/60 bg-card shadow-2xl sm:max-h-[90dvh] sm:rounded-3xl">
        <header className="flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-foreground">Post</h2>
            <p className="text-[11px] text-muted-foreground">Full post · conversation and engagement</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground" aria-label="Close full post"><X size={19} /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="flex items-center gap-3 px-4 py-4">
            <LazyImage src={post.authorPhoto || "/avatars/user.svg"} alt={post.authorName} className="h-11 w-11 rounded-full bg-muted object-cover" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-foreground">{post.authorName || "Member"}</p><p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 size={12} />{timeAgo(post.createdAt)}{post.isEdited ? " · Edited" : ""}</p></div>
          </div>
          {post.content?.trim() ? <p className="whitespace-pre-wrap break-words px-4 pb-4 text-[15px] leading-7 text-foreground">{post.content}</p> : null}
          {post.video ? <div className="bg-black"><video src={post.video} controls playsInline className="max-h-[65dvh] w-full object-contain" /></div> : null}
          {media.length > 0 ? <div className="relative bg-black">
            <button type="button" onClick={() => onOpenMedia?.(media[mediaIndex] || media[0], post.content?.slice(0, 120) || "Post photo")} className="block w-full cursor-zoom-in" aria-label="Open photo full screen">
              <LazyImage src={media[mediaIndex] || media[0]} alt={`Post media ${mediaIndex + 1}`} className="max-h-[65dvh] w-full object-contain" />
            </button>
            {media.length > 1 ? <div className="flex items-center justify-center gap-2 bg-black px-3 py-2">{media.map((url, index) => <button key={`${url}-${index}`} type="button" onClick={() => setMediaIndex(index)} aria-label={`View image ${index + 1}`} aria-pressed={index === mediaIndex} className={`h-2.5 w-2.5 rounded-full ${index === mediaIndex ? "bg-white" : "bg-white/35"}`} />)}<span className="ml-1 text-[11px] text-white/70">{mediaIndex + 1} of {media.length}</span></div> : null}
          </div> : null}
          {post.pdf ? <a href={post.pdf} target="_blank" rel="noopener noreferrer" className="mx-4 my-3 flex items-center gap-2 rounded-xl border border-border p-3 text-sm font-semibold text-foreground"><ImageIcon size={18} />{post.pdfName || "Open attached document"}</a> : null}
          <div className="mx-4 mt-3 rounded-2xl border border-border/60 bg-muted/25 p-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-lg font-extrabold tabular-nums text-foreground">{likes.toLocaleString()}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Likes</p></div>
              <div><p className="text-lg font-extrabold tabular-nums text-foreground">{commentCount.toLocaleString()}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Comments</p></div>
              <div><p className="text-lg font-extrabold tabular-nums text-foreground">{shares.toLocaleString()}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Shares</p></div>
            </div>
            {reactionEntries.length ? <div className="mt-3 flex flex-wrap gap-2 border-t border-border/50 pt-3">{reactionEntries.map(([type, count]) => <span key={type} className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-2.5 py-1 text-xs font-semibold text-foreground"><span>{REACTION_EMOJI[type] || "✨"}</span><span>{Number(count).toLocaleString()}</span><span className="capitalize text-muted-foreground">{type.replace(/[_-]/g, " ")}</span></span>)}</div> : null}
          </div>
          <div className="px-4 pb-5 pt-4">
            <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-extrabold text-foreground">Recent comments</h3><span className="text-xs text-muted-foreground">{commentCount.toLocaleString()} total</span></div>
            {loadingComments && comments.length === 0 ? <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle size={17} className="animate-spin" />Loading comments…</div> : comments.length ? <div className="space-y-3">{comments.slice(-10).map((comment) => <div key={comment.id} className="flex gap-2.5"><LazyImage src={comment.authorPhoto || "/avatars/user.svg"} alt="" className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-muted object-cover" /><div className="min-w-0 flex-1 rounded-2xl bg-muted/55 px-3 py-2"><p className="text-xs font-bold text-foreground">{comment.authorName || "Member"}<span className="ml-2 font-normal text-muted-foreground">{timeAgo(comment.createdAt)}</span></p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-foreground">{comment.text}</p>{comment.reactionCounts && Object.entries(comment.reactionCounts).some(([, count]) => count > 0) ? <p className="mt-1 text-[11px] text-muted-foreground">{Object.entries(comment.reactionCounts).filter(([, count]) => count > 0).map(([emoji, count]) => `${emoji} ${count}`).join(" · ")}</p> : null}</div></div>)}</div> : <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No comments yet. Start the conversation.</p>}
          </div>
        </div>
        <footer className="flex shrink-0 gap-2 border-t border-border/50 bg-card p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={() => onComments(post.id)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700"><MessageCircle size={17} />{commentCount ? `View all ${commentCount} comments` : "Write a comment"}</button>
          <button type="button" onClick={() => onShare(post.id)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-4 text-sm font-bold text-foreground hover:bg-muted"><Share2 size={17} />Share</button>
        </footer>
      </section>
    </div>
  )
}
