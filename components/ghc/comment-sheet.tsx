"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { onCloseTransientUI } from "@/lib/transient-ui"
import { X, Send, ChevronDown, ChevronUp, Heart, MessageCircle } from "lucide-react"
import { useGHC } from "@/contexts/ghc-context"
import type { Post, PostComment } from "@/lib/ghc-types"
import { timeAgo } from "@/lib/ghc-data"
import { buildCommentTree, countThread } from "@/lib/comment-thread-utils"
import { LazyImage } from "./lazy-image"
import { ReportChooser } from "./report-chooser"
import { isOwnAuthor, canEditComment, canDeleteComment } from "@/lib/ownership"

interface CommentSheetProps {
  post: Post | null
  open: boolean
  onClose: () => void
}

const QUICK_REACTIONS = ["❤️", "👍", "😂", "🔥", "👏"] as const

/**
 * Full comment sheet with nested threads + ownership rules:
 * - Anyone can reply (subject to block/privacy elsewhere)
 * - Comment author: edit + delete own
 * - Post owner: delete any comment on their post
 * - Report available on every comment
 */
export function CommentSheet({ post, open, onClose }: CommentSheetProps) {
  const {
    profile,
    blockedUsers,
    addComment,
    editComment,
    deleteComment,
    addCommentReaction,
    reportContent,
    blockUser,
    addToast,
  } = useGHC()
  const [text, setText] = useState("")
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [busy, setBusy] = useState(false)
  const submittingRef = useRef(false)
  const [visibleCount, setVisibleCount] = useState(40)
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({})
  const [sortMode, setSortMode] = useState<"newest" | "oldest">("newest")
  const listRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const isPostOwner = isOwnAuthor(post?.authorId, post?.authorName, profile)

  const tree = useMemo(() => {
    if (!post?.comments?.length) return [] as PostComment[]
    const built = buildCommentTree(post.comments)
    const sorted = [...built].sort((a, b) => {
      const ta = a.createdAt || 0
      const tb = b.createdAt || 0
      return sortMode === "newest" ? tb - ta : ta - tb
    })
    const blockedSet = new Set(blockedUsers || [])
    return sorted.filter((c) => c.authorId && !blockedSet.has(c.authorId))
  }, [post, sortMode, blockedUsers])

  useEffect(() => {
    if (!open) return
    return onCloseTransientUI(() => onClose())
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) setVisibleCount(40)
  }, [open, post?.id])

  // Focus composer when opening
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 200)
      return () => clearTimeout(t)
    }
  }, [open])

  // Reset ephemeral state when sheet closes
  useEffect(() => {
    if (!open) {
      setText("")
      setReplyToId(null)
      setEditingId(null)
      setEditText("")
    }
  }, [open])

  if (!open || !post) return null

  const isCommentOwner = (c: PostComment) => isOwnAuthor(c.authorId, c.authorName, profile)
  const canDelete = (c: PostComment) => canDeleteComment(c.authorId, c.authorName, post.authorId, profile)
  const canEdit = (c: PostComment) => canEditComment(c.authorId, c.authorName, profile)

  const handleSubmit = async () => {
    const value = text.trim()
    if (!value || busy || submittingRef.current || !post?.id) return
    submittingRef.current = true
    setBusy(true)
    try {
      await addComment(post.id, value, replyToId || undefined)
      setText("")
      setReplyToId(null)
      // Toast may also come from context — keep one friendly line if needed
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
      })
    } catch {
      // Keep entered text for retry
      try {
        addToast("Could not post comment — your text was kept", "error")
      } catch {
        /* */
      }
    } finally {
      submittingRef.current = false
      setBusy(false)
    }
  }

  const handleSaveEdit = async (commentId: string) => {
    const value = editText.trim()
    if (!value || busy) return
    setBusy(true)
    try {
      await editComment(post.id, commentId, value)
      setEditingId(null)
      setEditText("")
      addToast("Comment updated", "success")
    } catch {
      addToast("Could not edit comment", "error")
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    if (busy) return
    if (!window.confirm("Delete this comment?")) return
    setBusy(true)
    try {
      await deleteComment(post.id, commentId)
      addToast("Comment deleted", "info")
    } finally {
      setBusy(false)
    }
  }

  const toggleThread = (id: string) => {
    setExpandedThreads((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleLikeComment = async (c: PostComment, emoji = "❤️") => {
    try {
      await addCommentReaction(post.id, c.id, emoji)
    } catch {
      /* silent */
    }
  }

  const reactionCount = (c: PostComment) => {
    const reactions = c.reactions || {}
    return Object.values(reactions).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
  }

  const renderComment = (c: PostComment, depth = 0) => {
    const replies = c.replies || []
    const threadCount = countThread(c)
    const isExpanded = expandedThreads[c.id] ?? depth === 0
    const showCollapse = depth === 0 && threadCount > 0
    const visibleReplies = isExpanded || depth > 0 ? replies : []
    const liked = reactionCount(c) > 0

    return (
      <div
        key={c.id}
        className={`${depth > 0 ? "ml-3 border-l-2 border-emerald-200/80 pl-3" : ""} py-1.5`}
      >
        <div className="flex gap-2.5">
          <LazyImage
            src={c.authorPhoto || "/placeholder.svg?width=32&height=32"}
            alt={c.authorName}
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="rounded-2xl bg-stone-50 px-3 py-2 ring-1 ring-stone-100">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-gray-900">{c.authorName}</span>
                {isCommentOwner(c) && (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                    You
                  </span>
                )}
                <span className="text-[10px] text-gray-400">{timeAgo(c.createdAt)}</span>
                {c.isEdited && <span className="text-[10px] text-gray-400">(edited)</span>}
                {c.isPinned && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                    Pinned
                  </span>
                )}
              </div>
              {editingId === c.id ? (
                <div className="mt-1 space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value.slice(0, 1000))}
                    className="w-full resize-none rounded-lg border border-gray-200 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    rows={2}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveEdit(c.id)}
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null)
                        setEditText("")
                      }}
                      className="rounded-lg bg-gray-200 px-3 py-1 text-xs font-bold text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-800">{c.text}</p>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2.5 px-1 text-[11px] font-semibold text-gray-500">
              <button
                type="button"
                className={`inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 transition ${liked ? "bg-rose-50 text-rose-600" : "hover:bg-muted hover:text-foreground"}`}
                onClick={() => void handleLikeComment(c)}
                aria-label="Like comment"
              >
                <Heart size={14} className={liked ? "fill-current" : ""} />
                {liked ? reactionCount(c) : "Like"}
              </button>
              <button
                type="button"
                className="inline-flex min-h-9 items-center rounded-full px-2.5 transition hover:bg-emerald-50 hover:text-emerald-700"
                onClick={() => {
                  setReplyToId(c.id)
                  setText("")
                  inputRef.current?.focus()
                }}
              >
                Reply
              </button>
              {canEdit(c) && editingId !== c.id && (
                <button
                  type="button"
                  className="hover:text-emerald-700"
                  onClick={() => {
                    setEditingId(c.id)
                    setEditText(c.text)
                  }}
                >
                  Edit
                </button>
              )}
              {canDelete(c) && (
                <button
                  type="button"
                  className="hover:text-red-600"
                  onClick={() => void handleDelete(c.id)}
                >
                  Delete
                </button>
              )}
              <ReportChooser
                compact
                label="Report"
                targetType="comment"
                targetId={c.id}
                onSubmit={(reason) => {
                  void reportContent("comment", c.id, reason)
                  addToast("Report submitted", "success")
                }}
                onBlockAfterReport={
                  c.authorId && c.authorId !== "current-user"
                    ? () => void blockUser(c.authorId)
                    : undefined
                }
              />
            </div>

            {/* Quick reactions row */}
            {editingId !== c.id && (
              <div className="mt-1 flex gap-0.5 px-0.5">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="rounded-full px-1.5 py-0.5 text-sm transition hover:bg-stone-100 active:scale-90"
                    onClick={() => void handleLikeComment(c, emoji)}
                    aria-label={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {showCollapse && (
              <button
                type="button"
                onClick={() => toggleThread(c.id)}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp size={14} /> Hide replies
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} /> View {threadCount}{" "}
                    {threadCount === 1 ? "reply" : "replies"}
                  </>
                )}
              </button>
            )}

            {visibleReplies.map((r) => renderComment(r, depth + 1))}
          </div>
        </div>
      </div>
    )
  }

  const replyParent = replyToId ? post.comments?.find((c) => c.id === replyToId) : null
  const totalCount = post.comments?.length ?? 0

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end bg-black/50"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(88dvh,calc(100dvh-env(safe-area-inset-top)))] w-full flex-col rounded-t-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comment-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <div>
            <h3 id="comment-sheet-title" className="flex items-center gap-1.5 text-base font-bold text-gray-900">
              <MessageCircle size={16} className="text-emerald-600" />
              Comments
            </h3>
            <p className="text-[11px] text-gray-500">
              {totalCount} · {post.authorName}&apos;s post
              {isPostOwner ? " · You own this post" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSortMode((m) => (m === "newest" ? "oldest" : "newest"))}
              className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-bold text-stone-600"
              aria-label={`Sort by ${sortMode}`}
            >
              {sortMode === "newest" ? "Newest" : "Oldest"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
              aria-label="Close comments"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          {tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <MessageCircle size={22} />
              </div>
              <p className="text-sm font-semibold text-stone-800">No comments yet</p>
              <p className="mt-1 max-w-xs text-xs text-stone-500">
                Be the first with a thoughtful reply. Quality comments help the conversation — spam does not.
              </p>
            </div>
          ) : (
            <>
              {tree.slice(0, visibleCount).map((c) => renderComment(c))}
              {tree.length > visibleCount && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((n) => n + 40)}
                  className="mx-auto mt-2 block rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Load more comments ({tree.length - visibleCount} left)
                </button>
              )}
            </>
          )}
        </div>

        <div className="border-t border-stone-100 bg-white px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
          {replyParent && (
            <div className="mb-2 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  Replying to
                </p>
                <p className="truncate text-xs font-semibold text-gray-800">
                  {replyParent.authorName}
                  {replyParent.text ? (
                    <span className="font-normal text-gray-500">
                      {" "}
                      · {replyParent.text.slice(0, 48)}
                      {replyParent.text.length > 48 ? "…" : ""}
                    </span>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                className="ml-2 shrink-0 rounded-full p-1.5 font-bold text-emerald-800 hover:bg-emerald-100"
                onClick={() => setReplyToId(null)}
                aria-label="Cancel reply"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[11px] text-gray-500">
              Comment as{" "}
              <span className="font-bold text-gray-800">{profile.displayName || "You"}</span>
            </p>
            {text.length > 0 && (
              <span
                className={`text-[10px] font-semibold ${
                  text.length > 900 ? "text-amber-600" : "text-stone-400"
                }`}
              >
                {text.length}/1000
              </span>
            )}
          </div>
          <div className="flex items-end gap-2">
            <LazyImage
              src={profile.photos?.[0] || "/placeholder.svg?width=32&height=32"}
              alt={profile.displayName || "You"}
              className="mb-1 h-8 w-8 shrink-0 rounded-full object-cover"
            />
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 1000))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void handleSubmit()
                }
              }}
              placeholder={
                replyParent ? `Reply to ${replyParent.authorName}…` : "Write a thoughtful comment…"
              }
              rows={1}
              className="min-h-10 max-h-28 flex-1 resize-none rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
              aria-label="Comment text"
            />
            <button
              type="button"
              disabled={!text.trim() || busy}
              onClick={() => void handleSubmit()}
              className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition enabled:hover:bg-emerald-700 disabled:bg-gray-300"
              aria-label="Post comment"
            >
              {busy ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-stone-400">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}
