"use client"

/**
 * Interactive poll on a feed post — votes via /api/social/polls (server-authoritative).
 * Never invents tallies when the server rejects the vote.
 */

import { useCallback, useMemo, useState } from "react"
import { BarChart3 } from "lucide-react"

export type PollOptionView = { id: string; text: string; votes?: number }
export type PollView = {
  id: string
  question: string
  options: PollOptionView[]
  closesAt?: number | null
  viewerOptionId?: string | null
}

function parsePollFromContent(content: string): PollView | null {
  const text = String(content || "")
  if (!text.includes("📊 POLL") && !text.includes("pollId:")) return null
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const qLine = lines.find((l) => l !== "📊 POLL" && !l.startsWith("⏱") && !l.startsWith("Audience:") && !/^\d+\./.test(l) && !l.startsWith("pollId:"))
  const opts = lines
    .filter((l) => /^\d+\.\s+/.test(l))
    .map((l, i) => ({
      id: `opt_${i}`,
      text: l.replace(/^\d+\.\s+/, "").trim(),
      votes: 0,
    }))
  const idLine = lines.find((l) => l.startsWith("pollId:"))
  const pollId = idLine ? idLine.replace(/^pollId:\s*/, "").trim() : ""
  if (!qLine || opts.length < 2) return null
  return {
    id: pollId || `local_${qLine.slice(0, 12)}`,
    question: qLine,
    options: opts,
    closesAt: null,
    viewerOptionId: null,
  }
}

export function resolvePostPoll(post: {
  content?: string
  poll?: PollView | null
  special?: string
}): PollView | null {
  if (post.poll && post.poll.id && Array.isArray(post.poll.options) && post.poll.options.length >= 2) {
    return post.poll
  }
  return parsePollFromContent(String(post.content || ""))
}

export function PollInline({
  poll: initial,
  postId,
}: {
  poll: PollView
  postId: string
}) {
  const [poll, setPoll] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const closed = Boolean(poll.closesAt && poll.closesAt < Date.now())
  const total = useMemo(
    () => poll.options.reduce((s, o) => s + Number(o.votes || 0), 0),
    [poll.options],
  )

  const vote = useCallback(
    async (optionId: string) => {
      if (busy || closed || poll.viewerOptionId) return
      if (!poll.id || poll.id.startsWith("local_")) {
        setError("This poll is not on the server yet — refresh after publishing online")
        return
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setError("You are offline — vote when reconnected")
        return
      }
      setBusy(true)
      setError(null)
      try {
        const res = await fetch("/api/social/polls", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "vote", pollId: poll.id, optionId, postId }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          error?: string
          options?: PollOptionView[]
        }
        if (!res.ok || data.ok === false) {
          if (data.error === "ALREADY_VOTED") {
            setPoll((p) => ({ ...p, viewerOptionId: optionId }))
            setError("You already voted on this poll")
          } else {
            setError(data.error || "Could not record vote")
          }
          return
        }
        setPoll((p) => ({
          ...p,
          viewerOptionId: optionId,
          options: Array.isArray(data.options)
            ? data.options
            : p.options.map((o) =>
                o.id === optionId ? { ...o, votes: Number(o.votes || 0) + 1 } : o,
              ),
        }))
        try {
          window.dispatchEvent(
            new CustomEvent("ghc:post-engagement", {
              detail: { postId, kind: "poll_vote", pollId: poll.id },
            }),
          )
        } catch {
          /* */
        }
      } catch {
        setError("Could not reach the poll service")
      } finally {
        setBusy(false)
      }
    },
    [busy, closed, poll.id, poll.viewerOptionId, postId],
  )

  return (
    <div className="mt-2 rounded-2xl border border-amber-200/70 bg-amber-50/40 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
        <BarChart3 size={14} aria-hidden />
        Poll{closed ? " · closed" : ""}
      </div>
      <p className="mb-2 text-sm font-semibold text-foreground">{poll.question}</p>
      <ul className="space-y-1.5">
        {poll.options.map((o) => {
          const votes = Number(o.votes || 0)
          const pct = total > 0 ? Math.round((votes / total) * 100) : 0
          const selected = poll.viewerOptionId === o.id
          const showBars = Boolean(poll.viewerOptionId) || closed
          return (
            <li key={o.id}>
              <button
                type="button"
                disabled={busy || closed || Boolean(poll.viewerOptionId)}
                onClick={() => void vote(o.id)}
                className={`relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left text-sm transition disabled:cursor-default ${
                  selected
                    ? "border-amber-500 bg-amber-100/80 font-semibold dark:bg-amber-900/40"
                    : "border-border/70 bg-card hover:border-amber-300"
                }`}
              >
                {showBars ? (
                  <span
                    className="absolute inset-y-0 left-0 bg-amber-200/50 dark:bg-amber-800/30"
                    style={{ width: `${pct}%` }}
                    aria-hidden
                  />
                ) : null}
                <span className="relative flex items-center justify-between gap-2">
                  <span>{o.text}</span>
                  {showBars ? (
                    <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
                      {pct}% · {votes}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {error ? <p className="mt-2 text-[11px] text-rose-600">{error}</p> : null}
      {!poll.viewerOptionId && !closed ? (
        <p className="mt-2 text-[10px] text-muted-foreground">One vote per account · results after you vote</p>
      ) : null}
    </div>
  )
}
