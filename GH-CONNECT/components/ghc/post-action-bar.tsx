"use client"

import { softHaptic } from "@/lib/ui/premium-interaction"

/**
 * Post action bar — curation votes + respond actions.
 * Round 2 polish (ten new ideas, applied across card / action bar / curation panel):
 *  A. Sentiment accent edge on the card (positive / mixed / critical) — card + CSS
 *  B. Verified-author gradient avatar halo — card
 *  C. Live approval % label beside the meter — here
 *  D. Named vote-weight levels with a live description — here
 *  E. Glass action dock with lift + press ring — CSS (gh-pab-dock)
 *  F. Share button morphs to a check on tap — here
 *  G. Labeled action pills from sm up (icons only on phones) — here
 *  H. Approval ring in the curation summary row — post-reward-panel
 *  I. Gauge hero + plain-language insight in the curation sheet — post-reward-panel
 *  J. Shimmer skeletons + accented stat tiles while analytics load — post-reward-panel
 * Round 1 (kept):
 *  1. Fused vote pill with a live approval meter
 *  2. Spring "pop" and floating +1 / −1 burst on vote
 *  3. Friendly quality chip + segmented stepper (replaces the native <select>)
 *  4. Respond actions as labeled soft pills with counts
 *  5. Light haptics on vote / save / share
 *  6. In-button spinner while a vote saves (row no longer dims)
 *  7. Decluttered header: one info button instead of a permanent caption row
 *  8. Glass reaction tray styling lives in the card (see gh-pab-tray)
 *  9. 44px touch targets, visible focus rings, dark-mode contrast, reduced-motion + forced-colors safe
 * 10. Bookmark fill sweep when saving
 * Behaviour (server-confirmed votes, long-press / right-click voter roster) is unchanged.
 */

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react"
import { Bookmark, Check, Info, Loader2, MessageCircle, Share2, ThumbsDown, ThumbsUp } from "lucide-react"

export type PostVoteChoice = "upvote" | "downvote" | "neutral"
export type RosterPressProps = {
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void
  onPointerUp: () => void
  onPointerCancel: () => void
  onPointerLeave: () => void
  onContextMenu: (e: MouseEvent<HTMLButtonElement>) => void
}

const WEIGHTS = [0, 25, 50, 75, 100] as const
const WEIGHT_NAMES: Record<number, string> = { 0: "Signal only", 25: "Light", 50: "Balanced", 75: "Strong", 100: "Maximum" }
const buzz = (ms = 8) => { softHaptic(ms) }
const fmt = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : Number(n).toLocaleString())

export function PostActionBar({
  choice, busy, upCount, downCount, weight, onWeight, onVote, pressProps,
  commentCount, isSaved, onComment, onSave, onShare,
}: {
  choice: PostVoteChoice
  busy: boolean
  upCount: number
  downCount: number
  weight: number
  onWeight: (w: number) => void
  onVote: (c: "upvote" | "downvote") => void
  pressProps: (kind: "upvotes" | "downvotes") => RosterPressProps
  commentCount: number
  isSaved: boolean
  onComment: () => void
  onSave: () => void
  onShare: () => void
}) {
  const [panel, setPanel] = useState<null | "weight" | "info">(null)
  const [burst, setBurst] = useState<null | { kind: "up" | "down"; id: number }>(null)
  const [savePulse, setSavePulse] = useState(0)
  const [shared, setShared] = useState(false)
  const shareTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pending, setPending] = useState<null | "upvote" | "downvote">(null)
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (burstTimer.current) clearTimeout(burstTimer.current); if (shareTimer.current) clearTimeout(shareTimer.current) }, [])
  useEffect(() => { if (!busy) setPending(null) }, [busy])

  const total = upCount + downCount
  const pct = total > 0 ? Math.round((upCount / total) * 100) : null

  const vote = (e: MouseEvent, c: "upvote" | "downvote") => {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    if (choice !== c) {
      buzz(10)
      setBurst({ kind: c === "upvote" ? "up" : "down", id: Date.now() })
      if (burstTimer.current) clearTimeout(burstTimer.current)
      burstTimer.current = setTimeout(() => setBurst(null), 800)
    }
    setPending(c)
    onVote(c)
  }

  const voteBtn = (c: "upvote" | "downvote") => {
    const up = c === "upvote"
    const active = choice === c
    const Icon = up ? ThumbsUp : ThumbsDown
    return (
      <button
        type="button"
        disabled={busy}
        aria-label={active ? `Change vote to ${c}` : up ? "Upvote this post" : "Downvote this post"}
        aria-pressed={active}
        aria-busy={pending === c || undefined}
        onClick={(e) => vote(e, c)}
        {...pressProps(up ? "upvotes" : "downvotes")}
        title={`${up ? "Upvote" : "Downvote"} this post. Saved only after server confirmation. Long press or right-click to see voters.`}
        className={`gh-pab-btn relative inline-flex h-11 min-h-11 min-w-[3.25rem] items-center justify-center gap-1.5 px-3 text-[13px] font-extrabold tabular-nums transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 ${
          up ? "rounded-l-full focus-visible:ring-emerald-500" : "rounded-r-full focus-visible:ring-rose-500"
        } ${
          active
            ? up
              ? "bg-emerald-600 text-white shadow-inner dark:bg-emerald-500"
              : "bg-rose-600 text-white shadow-inner dark:bg-rose-500"
            : up
              ? "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
              : "text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/50"
        }`}
      >
        {pending === c && busy ? (
          <Loader2 size={17} className="animate-spin" aria-hidden />
        ) : (
          <Icon size={17} strokeWidth={2.4} aria-hidden className={active ? "gh-pab-pop" : ""} fill={active ? "currentColor" : "none"} />
        )}
        <span>{fmt(up ? upCount : downCount)}</span>
        {burst && burst.kind === (up ? "up" : "down") ? (
          <span key={burst.id} aria-hidden className={`gh-pab-burst pointer-events-none absolute -top-1 left-1/2 text-[12px] font-black ${up ? "text-emerald-500" : "text-rose-500"}`}>
            {up ? "+1" : "−1"}
          </span>
        ) : null}
      </button>
    )
  }

  const soft =
    "gh-pab-btn inline-flex h-11 min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-[12px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"

  return (
    <div className="gh-post-action-dock min-w-0 px-3 pb-3 pt-2.5 sm:px-4" role="toolbar" aria-label="Post actions and Community curation" data-pab-dock>
      <div className="gh-post-action-primary flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
        {/* 1 · fused vote pill + approval meter */}
        <div className="flex flex-col gap-1" role="group" aria-label="Quality votes">
          <div className="inline-flex items-stretch overflow-visible rounded-full border border-border/70 bg-card shadow-sm">
            {voteBtn("upvote")}
            <span aria-hidden className="my-2 w-px bg-border/80" />
            {voteBtn("downvote")}
          </div>
          <div className="mx-2 flex items-center gap-1.5">
            <div
              role="img"
              aria-label={pct === null ? "No votes yet" : `${pct}% positive from ${total} votes`}
              className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${
                  pct !== null && pct < 40 ? "bg-gradient-to-r from-rose-500 to-orange-400" : pct !== null && pct < 70 ? "bg-gradient-to-r from-amber-500 to-yellow-400" : "bg-gradient-to-r from-emerald-500 to-teal-400"
                }`}
                style={{ width: pct === null ? "0%" : `${pct}%` }}
              />
            </div>
            {pct !== null ? <span aria-hidden className="text-[10px] font-bold tabular-nums text-muted-foreground">{pct}%</span> : null}
          </div>
        </div>

        {/* 3 · weight chip */}
        <button
          type="button"
          aria-expanded={panel === "weight"}
          aria-controls="gh-pab-panel"
          onClick={() => setPanel((p) => (p === "weight" ? null : "weight"))}
          className="gh-pab-btn inline-flex min-h-11 items-center gap-1 rounded-full border border-border/70 bg-background px-2.5 text-[11px] font-bold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          title="How strongly your vote counts toward curation. Voting does not create GHC."
        >
          <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">Quality</span> <span className="tabular-nums text-[12px] font-bold text-foreground">{weight}%</span>
          <span className="hidden text-muted-foreground/80 sm:inline">· {WEIGHT_NAMES[weight] ?? "Custom"}</span>
        </button>

        {/* 7 · info instead of a permanent caption row */}
        <button
          type="button"
          aria-label="About votes"
          aria-expanded={panel === "info"}
          aria-controls="gh-pab-panel"
          onClick={() => setPanel((p) => (p === "info" ? null : "info"))}
          className="gh-pab-btn inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <Info size={15} aria-hidden />
        </button>

        {/* 4 · respond actions */}
      </div>
      <div className="gh-post-action-secondary mt-2 grid min-w-0 grid-cols-3 gap-1.5" role="group" aria-label="Respond to post">
          <button type="button" aria-label={`Comment · ${commentCount} ${commentCount === 1 ? "comment" : "comments"}`} title={`${commentCount} ${commentCount === 1 ? "comment" : "comments"}`} onClick={onComment} className={`${soft} gh-post-response-action min-w-0 flex-1 justify-center rounded-xl border border-border/50 bg-background/70 px-2`}>
            <MessageCircle size={17} aria-hidden />
            <span className="tabular-nums">{fmt(commentCount)}</span>
            <span>Comment</span>
          </button>
          <button
            type="button"
            aria-label={isSaved ? "Unsave" : "Save"}
            aria-pressed={isSaved}
            onClick={() => { buzz(8); setSavePulse((n) => n + 1); onSave() }}
            className={`${soft} gh-post-response-action min-w-0 flex-1 justify-center rounded-xl border border-border/50 bg-background/70 px-2 ${isSaved ? "!border-amber-300/60 !bg-amber-100 !text-amber-700 dark:!bg-amber-900/40 dark:!text-amber-300" : ""}`}
          >
            <Bookmark
              key={savePulse}
              size={18}
              aria-hidden
              fill={isSaved ? "currentColor" : "none"}
              className={isSaved && savePulse > 0 ? "gh-pab-save" : ""}
            />
            <span>{isSaved ? "Saved" : "Save"}</span>
          </button>
          <button
            type="button"
            aria-label="Share"
            onClick={() => {
              buzz(6)
              setShared(true)
              if (shareTimer.current) clearTimeout(shareTimer.current)
              shareTimer.current = setTimeout(() => setShared(false), 1600)
              onShare()
            }}
            className={`${soft} gh-post-response-action min-w-0 flex-1 justify-center rounded-xl border border-border/50 bg-background/70 px-2 ${shared ? "!text-emerald-700 dark:!text-emerald-300" : ""}`}
          >
            {shared ? <Check size={18} aria-hidden className="gh-pab-pop" /> : <Share2 size={18} aria-hidden />}
            <span>Share</span>
            <span className="sr-only" role="status">{shared ? "Share options opened" : ""}</span>
          </button>
        </div>

      {panel ? (
        <div id="gh-pab-panel" className="gh-pab-panel mt-2 rounded-2xl border border-border/60 bg-muted/40 p-2.5">
          {panel === "weight" ? (
            <>
              <div role="radiogroup" aria-label="Vote weight" className="grid grid-cols-5 gap-1">
                {WEIGHTS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    role="radio"
                    aria-checked={weight === w}
                    disabled={busy}
                    onClick={() => { softHaptic(8); onWeight(w) }}
                    className={`h-12 rounded-xl text-[12px] font-extrabold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                      weight === w ? "bg-violet-700 text-white" : "bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="block leading-none">{w}%</span>
                    <span className={`mt-0.5 block text-[8px] font-semibold uppercase tracking-wide ${weight === w ? "text-violet-100" : "text-muted-foreground"}`}>{WEIGHT_NAMES[w]}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground" aria-live="polite"><strong className="text-foreground">{WEIGHT_NAMES[weight] ?? "Custom"} ({weight}%)</strong> — {weight === 0 ? "your vote is recorded without lifting the post." : "higher weight lifts useful posts faster."} Votes are quality signals and never issue GHC.</p>
            </>
          ) : (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Your vote helps surface useful contributions. It is saved only after server confirmation. Long press (or right-click) a vote button to see who voted.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
