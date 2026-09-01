"use client"

/**
 * GreenHaven Poll composer
 * Professional decision tool — not a generic post with options.
 * Inspired by structured polls (clear question, 2–6 options, duration, audience).
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
  const { createPost, addToast, profile } = useGHC() as {
    createPost?: (
      content: string,
      images: string[],
      video: string | null,
      pdf: string | null,
      pdfName: string | null,
      audience?: "public" | "followers" | "mutuals" | "private",
    ) => Promise<boolean>
    addToast?: (m: string, t?: string) => void
    profile?: { displayName?: string; photos?: string[] }
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
    setBusy(true)
    try {
      const opts = options.map((o) => o.trim()).filter(Boolean)
      const dur = DURATIONS.find((d) => d.id === duration) || DURATIONS[1]
      const body = [
        `📊 POLL`,
        question.trim(),
        "",
        ...opts.map((o, i) => `${i + 1}. ${o}`),
        "",
        `⏱ Ends in ${dur.label} · Vote in comments or reactions`,
        audience === "followers" ? "Audience: Followers" : "Audience: Public",
      ].join("\n")

      const ok = await createPost(body, [], null, null, null, audience)
      if (ok) {
        try {
          const key = "ghc.polls.local.v1"
          const raw = localStorage.getItem(key)
          const list = raw ? JSON.parse(raw) : []
          list.unshift({
            id: `poll_${Date.now()}`,
            question: question.trim(),
            options: opts,
            durationId: duration,
            endsAt: Date.now() + dur.hours * 3600_000,
            createdAt: Date.now(),
            votes: opts.map(() => 0),
          })
          localStorage.setItem(key, JSON.stringify(list.slice(0, 40)))
        } catch {
          /* */
        }
        addToast?.("Poll published", "success")
        setQuestion("")
        setOptions(["", ""])
        onOpenChange(false)
      } else {
        addToast?.("Could not publish poll", "error")
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="Create poll">
      <header className="flex items-center justify-between border-b border-border px-3 py-2.5 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button type="button" onClick={() => onOpenChange(false)} className="flex h-10 w-10 items-center justify-center rounded-full" aria-label="Close">
          <X size={22} />
        </button>
        <div className="text-center">
          <p className="text-[15px] font-bold">Create poll</p>
          <p className="text-[10px] text-muted-foreground">Get a clear signal from your network</p>
        </div>
        <button
          type="button"
          disabled={!canPublish}
          onClick={() => void publish()}
          className="rounded-full bg-emerald-600 px-4 py-2 text-[13px] font-bold text-white disabled:opacity-40"
        >
          {busy ? "…" : "Publish"}
        </button>
      </header>

      <div className="mx-auto w-full max-w-[var(--gh-content-max,28rem)] flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <BarChart3 size={22} />
          </div>
          <div>
            <p className="text-sm font-bold">{profile?.displayName || "You"}</p>
            <p className="text-[11px] text-muted-foreground">Structured poll · not a plain post</p>
          </div>
        </div>

        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Question</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
          placeholder="What should we decide together?"
          rows={3}
          className="mb-4 w-full resize-none rounded-2xl border border-border bg-card px-3 py-3 text-[15px] outline-none focus:border-emerald-500"
        />

        <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Options (2–6)</label>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-bold text-muted-foreground">
                {i + 1}
              </span>
              <input
                value={opt}
                onChange={(e) => setOption(i, e.target.value.slice(0, 80))}
                placeholder={`Option ${i + 1}`}
                className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2.5 text-[14px] outline-none focus:border-emerald-500"
              />
              {options.length > 2 ? (
                <button type="button" onClick={() => removeOption(i)} className="text-muted-foreground" aria-label="Remove option">
                  <Trash2 size={16} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {options.length < 6 ? (
          <button
            type="button"
            onClick={addOption}
            className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-emerald-700 dark:text-emerald-300"
          >
            <Plus size={16} /> Add option
          </button>
        ) : null}

        <div className="mt-6 space-y-3">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <Clock size={12} /> Duration
            </p>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDuration(d.id)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                    duration === d.id ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <Users size={12} /> Who can vote
            </p>
            <div className="flex gap-2">
              {(
                [
                  { id: "public" as const, label: "Everyone" },
                  { id: "followers" as const, label: "Followers" },
                ] as const
              ).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAudience(a.id)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                    audience === a.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
          Polls are published to your feed with a clear structure so people can respond quickly.
          Results stay on-device until live voting is enabled server-side.
        </p>
      </div>
    </div>
  )
}

export default PollComposer
