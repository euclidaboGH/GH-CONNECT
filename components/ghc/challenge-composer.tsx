"use client"

/**
 * GreenHaven Challenge (Reward Quest)
 * Feed announcement + local progress track. Completions stay server-validated in Rewards.
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
    if (!createPost || busy) return
    if (templateId === "custom" && customTitle.trim().length < 4) {
      addToast?.("Give your custom challenge a clear title", "info")
      return
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      addToast?.("You are offline — launch the challenge when connected so others can see it", "info")
      return
    }
    setBusy(true)
    try {
      const title = templateId === "custom" ? customTitle.trim() || "Custom challenge" : tpl.title
      const blurb = templateId === "custom" ? customBlurb.trim() || tpl.blurb : tpl.blurb
      const challengeId = `ch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
      const body = [
        `🏆 CHALLENGE · ${title}`,
        blurb,
        "",
        `🎯 Goal: ${tpl.target} × ${tpl.metric}`,
        `📅 Window: ${tpl.days} days`,
        inviteNetwork ? "👥 Open invite — join from this post" : "Personal quest",
        "",
        "Track progress in Rewards Centre. Completing challenges unlocks pending GHC only after validation.",
        `challengeId:${challengeId}`,
      ].join("\n")

      const ok = await createPost(body, [], null, null, null, "public")
      if (ok) {
        try {
          const key = "ghc.challenges.local.v1"
          const raw = localStorage.getItem(key)
          const list = raw ? JSON.parse(raw) : []
          list.unshift({
            id: challengeId,
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
            joined: true,
          })
          localStorage.setItem(key, JSON.stringify(list.slice(0, 30)))
        } catch {
          /* local track only */
        }
        try {
          window.dispatchEvent(
            new CustomEvent("ghc:post-engagement", {
              detail: { kind: "challenge_create", challengeId },
            }),
          )
        } catch {
          /* */
        }
        addToast?.("Challenge launched — track it under Rewards → Missions", "success")
        setCustomTitle("")
        setCustomBlurb("")
        onOpenChange(false)
      } else {
        addToast?.("Could not publish challenge", "error")
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="Create challenge">
      <header className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <button type="button" onClick={() => onOpenChange(false)} className="rounded-full p-2 hover:bg-muted" aria-label="Close">
          <X size={20} />
        </button>
        <h2 className="flex items-center gap-1.5 text-[15px] font-bold">
          <Trophy size={18} className="text-rose-600" /> Challenge
        </h2>
        <button
          type="button"
          disabled={busy}
          onClick={() => void publish()}
          className="rounded-full bg-rose-600 px-4 py-1.5 text-[13px] font-bold text-white disabled:opacity-40"
        >
          {busy ? "Launching…" : "Launch"}
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <p className="text-[12px] text-muted-foreground">
          Challenges are social quests. GHC rewards only land after server validation — this screen does not invent balances.
        </p>
        <div className="grid gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateId(t.id)}
              className={`rounded-2xl border px-3 py-3 text-left transition ${
                templateId === t.id
                  ? "border-rose-400 bg-rose-50 dark:bg-rose-950/30"
                  : "border-border bg-card hover:bg-muted/50"
              }`}
            >
              <p className="text-[14px] font-bold text-foreground">{t.title}</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{t.blurb}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t.days}d · {t.target} {t.metric}
              </p>
            </button>
          ))}
        </div>
        {templateId === "custom" ? (
          <div className="space-y-2">
            <input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value.slice(0, 80))}
              placeholder="Challenge title"
              className="min-h-11 w-full rounded-xl border border-border bg-card px-3 text-sm"
            />
            <textarea
              value={customBlurb}
              onChange={(e) => setCustomBlurb(e.target.value.slice(0, 240))}
              placeholder="What should people do?"
              rows={3}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
            />
          </div>
        ) : null}
        <label className="flex items-center gap-2 text-[13px] font-semibold">
          <input type="checkbox" checked={inviteNetwork} onChange={(e) => setInviteNetwork(e.target.checked)} />
          Invite network from the feed post
        </label>
        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
            <Target size={12} /> Clear goal
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
            <Flame size={12} /> Time-boxed
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
            <Sparkles size={12} /> Rewards-validated
          </span>
        </div>
      </div>
    </div>
  )
}

export default ChallengeComposer
