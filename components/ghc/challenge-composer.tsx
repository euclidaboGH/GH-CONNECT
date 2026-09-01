"use client"

/**
 * GreenHaven Challenge (Reward Quest)
 * Unique engagement loop: goal → duration → GHC/XP stake of reputation (not pay-to-win).
 * Distinct from polls and plain posts.
 */

import { useMemo, useState } from "react"
import { X, Trophy, Target, Flame, Sparkles } from "lucide-react"
import { useGHC } from "@/contexts/ghc-context"

const TEMPLATES = [
  {
    id: "connect7",
    title: "7-Day Connector",
    blurb: "Send 7 meaningful messages to different people",
    days: 7,
    metric: "messages",
    target: 7,
  },
  {
    id: "post3",
    title: "Creator Spark",
    blurb: "Publish 3 helpful posts this week",
    days: 7,
    metric: "posts",
    target: 3,
  },
  {
    id: "community",
    title: "Circle Builder",
    blurb: "Join or create a community and post on the board twice",
    days: 5,
    metric: "board",
    target: 2,
  },
  {
    id: "custom",
    title: "Custom quest",
    blurb: "Define your own challenge for your network",
    days: 7,
    metric: "custom",
    target: 1,
  },
] as const

export function ChallengeComposer({
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
    profile?: { displayName?: string }
  }

  const [templateId, setTemplateId] = useState<(typeof TEMPLATES)[number]["id"]>("connect7")
  const [customTitle, setCustomTitle] = useState("")
  const [customBlurb, setCustomBlurb] = useState("")
  const [inviteNetwork, setInviteNetwork] = useState(true)
  const [busy, setBusy] = useState(false)

  const tpl = useMemo(() => TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0], [templateId])

  if (!open) return null

  const publish = async () => {
    if (!createPost) return
    setBusy(true)
    try {
      const title = templateId === "custom" ? customTitle.trim() || "Custom challenge" : tpl.title
      const blurb = templateId === "custom" ? customBlurb.trim() || tpl.blurb : tpl.blurb
      const body = [
        `🏆 CHALLENGE · ${title}`,
        blurb,
        "",
        `🎯 Goal: ${tpl.target} × ${tpl.metric}`,
        `📅 Window: ${tpl.days} days`,
        inviteNetwork ? "👥 Open invite — join from this post" : "Personal quest",
        "",
        "Track progress in Rewards Centre. Completing challenges can unlock pending GHC after validation.",
      ].join("\n")

      const ok = await createPost(body, [], null, null, null, "public")
      if (ok) {
        try {
          const key = "ghc.challenges.local.v1"
          const raw = localStorage.getItem(key)
          const list = raw ? JSON.parse(raw) : []
          list.unshift({
            id: `ch_${Date.now()}`,
            templateId,
            title,
            blurb,
            days: tpl.days,
            metric: tpl.metric,
            target: tpl.target,
            progress: 0,
            createdAt: Date.now(),
            endsAt: Date.now() + tpl.days * 86400_000,
            owner: profile?.displayName || "You",
          })
          localStorage.setItem(key, JSON.stringify(list.slice(0, 30)))
        } catch {
          /* */
        }
        addToast?.("Challenge launched", "success")
        onOpenChange(false)
      } else {
        addToast?.("Could not start challenge", "error")
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="Start challenge">
      <header className="flex items-center justify-between border-b border-border px-3 py-2.5 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button type="button" onClick={() => onOpenChange(false)} className="flex h-10 w-10 items-center justify-center rounded-full" aria-label="Close">
          <X size={22} />
        </button>
        <div className="text-center">
          <p className="text-[15px] font-bold">Challenge</p>
          <p className="text-[10px] text-muted-foreground">Reward quests · real activity</p>
        </div>
        <button
          type="button"
          disabled={busy || (templateId === "custom" && customTitle.trim().length < 4)}
          onClick={() => void publish()}
          className="rounded-full bg-rose-600 px-4 py-2 text-[13px] font-bold text-white disabled:opacity-40"
        >
          {busy ? "…" : "Launch"}
        </button>
      </header>

      <div className="mx-auto w-full max-w-[var(--gh-content-max,28rem)] flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-4 overflow-hidden rounded-3xl bg-gradient-to-br from-rose-600 via-rose-500 to-amber-500 p-4 text-white shadow-lg">
          <div className="flex items-center gap-2">
            <Trophy size={22} />
            <p className="text-sm font-bold">GreenHaven Quests</p>
          </div>
          <p className="mt-1 text-[12px] text-white/90">
            Challenges reward meaningful participation — not spam. Server validation applies before GHC credits.
          </p>
        </div>

        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Choose a quest</p>
        <div className="space-y-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateId(t.id)}
              className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                templateId === t.id
                  ? "border-rose-400 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40"
                  : "border-border bg-card"
              }`}
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200">
                {t.id === "custom" ? <Sparkles size={18} /> : t.id === "post3" ? <Flame size={18} /> : <Target size={18} />}
              </span>
              <span>
                <span className="block text-[13px] font-bold text-foreground">{t.title}</span>
                <span className="block text-[11px] text-muted-foreground">{t.blurb}</span>
                <span className="mt-1 block text-[10px] font-semibold text-rose-700 dark:text-rose-300">
                  {t.days} days · target {t.target}
                </span>
              </span>
            </button>
          ))}
        </div>

        {templateId === "custom" ? (
          <div className="mt-4 space-y-2">
            <input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value.slice(0, 60))}
              placeholder="Challenge title"
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[14px] outline-none focus:border-rose-500"
            />
            <textarea
              value={customBlurb}
              onChange={(e) => setCustomBlurb(e.target.value.slice(0, 160))}
              placeholder="What does success look like?"
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2.5 text-[14px] outline-none focus:border-rose-500"
            />
          </div>
        ) : null}

        <label className="mt-5 flex items-center gap-2 text-[13px] font-medium text-foreground">
          <input
            type="checkbox"
            checked={inviteNetwork}
            onChange={(e) => setInviteNetwork(e.target.checked)}
            className="rounded border-border"
          />
          Invite others to join this challenge
        </label>

        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          Launching publishes a challenge card to your feed and tracks progress locally until the
          rewards engine confirms completion server-side.
        </p>
      </div>
    </div>
  )
}

export default ChallengeComposer
