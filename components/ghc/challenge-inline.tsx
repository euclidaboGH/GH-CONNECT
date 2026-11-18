"use client"

/**
 * Challenge card on a feed post — join tracks locally; GHC stays server-validated.
 */

import { useEffect, useMemo, useState } from "react"
import { Trophy } from "lucide-react"
import { navigateTo } from "@/lib/navigation/navigate"

export type ChallengeView = {
  id: string
  title: string
  blurb: string
  target: number
  metric: string
  days: number
  endsAt?: number
}

function parseChallengeFromContent(content: string): ChallengeView | null {
  const text = String(content || "")
  if (!text.includes("🏆 CHALLENGE") && !text.includes("challengeId:")) return null
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const titleLine = lines.find((l) => l.startsWith("🏆 CHALLENGE"))
  const title = titleLine ? titleLine.replace(/^🏆 CHALLENGE\s*·\s*/, "").trim() : "Challenge"
  const blurb = lines.find((l) => !l.startsWith("🏆") && !l.startsWith("🎯") && !l.startsWith("📅") && !l.startsWith("👥") && !l.startsWith("Track") && !l.startsWith("challengeId:") && !l.startsWith("Personal"))
  const goal = lines.find((l) => l.startsWith("🎯"))
  const window = lines.find((l) => l.startsWith("📅"))
  const idLine = lines.find((l) => l.startsWith("challengeId:"))
  const id = idLine ? idLine.replace(/^challengeId:\s*/, "").trim() : `local_${title.slice(0, 8)}`
  let target = 1
  let metric = "actions"
  if (goal) {
    const m = goal.match(/(\d+)\s*×\s*(\w+)/)
    if (m) {
      target = Number(m[1]) || 1
      metric = m[2] || "actions"
    }
  }
  let days = 7
  if (window) {
    const m = window.match(/(\d+)\s*days?/i)
    if (m) days = Number(m[1]) || 7
  }
  return {
    id,
    title,
    blurb: blurb || "",
    target,
    metric,
    days,
  }
}

export function resolvePostChallenge(post: { content?: string }): ChallengeView | null {
  return parseChallengeFromContent(String(post.content || ""))
}

export function ChallengeInline({ challenge, readOnly = false }: { challenge: ChallengeView; readOnly?: boolean }) {
  const [joined, setJoined] = useState(false)
  const [joining, setJoining] = useState(false)
  const durableId = /^[0-9a-f-]{36}$/i.test(challenge.id)
  useEffect(() => {
    if (!durableId) return
    let active = true
    void fetch(`/api/social/challenges?challengeId=${encodeURIComponent(challenge.id)}`, { credentials: "include", cache: "no-store" }).then((r) => r.json()).then((d) => { if (active && d?.ok) setJoined(d.joined === true) }).catch(() => undefined)
    return () => { active = false }
  }, [challenge.id, durableId])
  const endsLabel = useMemo(() => `${challenge.days} day window`, [challenge.days])

  const onJoin = async () => {
    if (joining) return
    setJoining(true)
    let succeeded = false
    try {
      const response = await fetch("/api/social/challenges", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join", challengeId: challenge.id }) })
      const data = await response.json()
      if (!response.ok || !data?.ok) throw new Error(data?.error || "JOIN_FAILED")
      setJoined(true)
      succeeded = true
    } catch {
      window.dispatchEvent(new CustomEvent("ghc:toast", { detail: { message: "Could not join this challenge. Please try again.", type: "error" } }))
    } finally { setJoining(false) }
    if (!succeeded) return
    try {
      window.dispatchEvent(
        new CustomEvent("ghc:toast", {
          detail: {
            message: "Joined challenge — progress is tracked in Rewards → Missions",
            type: "success",
          },
        }),
      )
      window.dispatchEvent(
        new CustomEvent("ghc:post-engagement", {
          detail: { kind: "challenge_join", challengeId: challenge.id },
        }),
      )
    } catch {
      /* */
    }
  }

  return (
    <div className="mt-2 rounded-2xl border border-rose-200/70 bg-rose-50/40 p-3 dark:border-rose-900/50 dark:bg-rose-950/20">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-800 dark:text-rose-200">
        <Trophy size={14} aria-hidden /> Challenge
      </div>
      <p className="text-sm font-bold text-foreground">{challenge.title}</p>
      {challenge.blurb ? <p className="mt-0.5 text-[12px] text-muted-foreground">{challenge.blurb}</p> : null}
      <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
        Goal {challenge.target} × {challenge.metric} · {endsLabel}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {readOnly ? (
          <span className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">Preview only · participation unavailable</span>
        ) : !durableId ? (
          <span className="rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">Legacy challenge · new participation unavailable</span>
        ) : !joined ? (
          <button
            type="button"
            onClick={() => void onJoin()}
            disabled={joining}
            className="rounded-full bg-rose-600 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
          >
            {joining ? "Joining…" : "Join challenge"}
          </button>
        ) : (
          <span className="rounded-full border border-rose-300 px-3 py-1.5 text-[12px] font-bold text-rose-800 dark:text-rose-200">
            Joined
          </span>
        )}
        {!readOnly ? <button
          type="button"
          onClick={() => {
            try {
              navigateTo("settings", { section: "rewards" })
            } catch {
              window.dispatchEvent(new CustomEvent("ghc:open-settings", { detail: { section: "rewards" } }))
            }
          }}
          className="rounded-full border border-border px-3 py-1.5 text-[12px] font-semibold"
        >
          Open Missions
        </button> : null}
      </div>
    </div>
  )
}
