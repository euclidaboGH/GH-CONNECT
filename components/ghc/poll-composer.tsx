"use client"

/**
 * GreenHaven Poll composer
 * Durable poll via /api/social/polls + feed post for distribution.
 */

import { useMemo, useState } from "react"
import { X, Plus, Trash2, BarChart3, Clock, Users } from "lucide-react"
import { useGHC } from "@/contexts/ghc-context"

const DURATIONS = [
  { id: "1d", label: "1 day", hours: 24 },
  { id: "3d", label: "3 days", hours: 72 },
  { id: "7d", label: "1 week", hours: 168 },
  { id: "14d", label: "2 weeks", hours: 336 },
] as const

export function PollComposer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { createPost, addToast } = useGHC() as {
    createPost?: (
      content: string,
      images: string[],
      video: string | null,
      pdf: string | null,
      pdfName: string | null,
      audience?: "public" | "followers" | "mutuals" | "private",
    ) => Promise<boolean>
    addToast?: (m: string, t?: string) => void
  }

  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState(["", ""])
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]["id"]>("3d")
  const [audience, setAudience] = useState<"public" | "followers">("public")
  const [busy, setBusy] = useState(false)

  const canPublish = useMemo(() => {
    const q = question.trim().length >= 8
    const opts = options.map((o) => o.trim()).filter(Boolean)
    return q && opts.length >= 2 && !busy
  }, [question, options, busy])

  if (!open) return null

  const setOption = (i: number, v: string) => {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)))
  }

  const addOption = () => {
    if (options.length >= 6) return
    setOptions((prev) => [...prev, ""])
  }

  const removeOption = (i: number) => {
    if (options.length <= 2) return
    setOptions((prev) => prev.filter((_, idx) => idx !== i))
  }

  const publish = async () => {
    if (!canPublish || !createPost) return
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      addToast?.("You are offline — polls need a connection to record votes fairly", "info")
      return
    }
    setBusy(true)
    try {
      const opts = options.map((o) => o.trim()).filter(Boolean)
      const dur = DURATIONS.find((d) => d.id === duration) || DURATIONS[1]
      const endsAt = Date.now() + dur.hours * 3600_000
      const optionRows = opts.map((text, i) => ({ id: `opt_${i}`, text }))

      // 1) Durable poll first (authoritative id)
      let pollId = ""
      let durable = false
      try {
        const res = await fetch("/api/social/polls", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: question.trim(),
            options: optionRows,
            closesAt: endsAt,
          }),
        })
        const data = await res.json().catch(() => ({})) as {
          ok?: boolean
          durable?: boolean
          poll?: { id?: string }
          error?: string
        }
        if (!res.ok || data.ok === false) {
          addToast?.(String(data.error || "Could not create poll on the server"), "error")
          return
        }
        pollId = String(data.poll?.id || "")
        durable = Boolean(data.durable)
      } catch {
        addToast?.("Could not reach the poll service", "error")
        return
      }
      if (!pollId) {
        addToast?.("Poll service did not return an id", "error")
        return
      }

      // 2) Distribution post (reference-only body + pollId marker for feed UI)
      const body = [
        "📊 POLL",
        question.trim(),
        "",
        ...opts.map((o, i) => `${i + 1}. ${o}`),
        "",
        `⏱ Ends in ${dur.label}`,
        audience === "followers" ? "Audience: Followers" : "Audience: Public",
        `pollId:${pollId}`,
      ].join("\n")

      const ok = await createPost(body, [], null, null, null, audience)
      if (!ok) {
        addToast?.("Poll was created but the feed post failed — try posting again from drafts", "error")
        return
      }

      try {
        const key = "ghc.polls.local.v1"
        const raw = localStorage.getItem(key)
        const list = raw ? JSON.parse(raw) : []
        list.unshift({
          id: pollId,
          question: question.trim(),
          options: optionRows,
          durationId: duration,
          endsAt,
          createdAt: Date.now(),
          votes: opts.map(() => 0),
          durable,
        })
        localStorage.setItem(key, JSON.stringify(list.slice(0, 40)))
      } catch {
        /* cache only */
      }

      try {
        window.dispatchEvent(
          new CustomEvent("ghc:post-engagement", {
            detail: { kind: "poll_create", pollId },
          }),
        )
      } catch {
        /* */
      }

      addToast?.(
        durable ? "Poll published" : "Poll saved on this device — will fully sync when durable storage is ready",
        durable ? "success" : "info",
      )
      setQuestion("")
      setOptions(["", ""])
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="Create poll">
      <header className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <button type="button" onClick={() => onOpenChange(false)} className="rounded-full p-2 hover:bg-muted" aria-label="Close">
          <X size={20} />
        </button>
        <h2 className="flex items-center gap-1.5 text-[15px] font-bold">
          <BarChart3 size={18} className="text-amber-600" /> Create poll
        </h2>
        <button
          type="button"
          disabled={!canPublish}
          onClick={() => void publish()}
          className="rounded-full bg-amber-600 px-4 py-1.5 text-[13px] font-bold text-white disabled:opacity-40"
        >
          {busy ? "Publishing…" : "Publish"}
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold text-muted-foreground">Question</span>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, 280))}
            rows={3}
            placeholder="What should we decide together?"
            className="w-full rounded-2xl border border-border bg-card px-3 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </label>
        <div>
          <span className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">Options (2–6)</span>
          <ul className="space-y-2">
            {options.map((o, i) => (
              <li key={i} className="flex gap-2">
                <input
                  value={o}
                  onChange={(e) => setOption(i, e.target.value.slice(0, 80))}
                  placeholder={`Option ${i + 1}`}
                  className="min-h-11 flex-1 rounded-xl border border-border bg-card px-3 text-sm"
                />
                {options.length > 2 ? (
                  <button type="button" onClick={() => removeOption(i)} className="rounded-xl p-2 text-muted-foreground hover:bg-muted" aria-label="Remove option">
                    <Trash2 size={16} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {options.length < 6 ? (
            <button type="button" onClick={addOption} className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-amber-700">
              <Plus size={16} /> Add option
            </button>
          ) : null}
        </div>
        <div>
          <span className="mb-1.5 flex items-center gap-1 text-[12px] font-semibold text-muted-foreground">
            <Clock size={14} /> Duration
          </span>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDuration(d.id)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  duration === d.id ? "bg-amber-600 text-white" : "bg-muted text-foreground"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1.5 flex items-center gap-1 text-[12px] font-semibold text-muted-foreground">
            <Users size={14} /> Audience
          </span>
          <div className="flex gap-2">
            {(["public", "followers"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAudience(a)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold capitalize ${
                  audience === a ? "bg-amber-600 text-white" : "bg-muted text-foreground"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Votes are recorded on the server when durable social is configured. One vote per account.
        </p>
      </div>
    </div>
  )
}

export default PollComposer
