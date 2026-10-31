"use client"

/**
 * Challenge card on a feed post — join tracks locally; GHC stays server-validated.
 */

import { useMemo, useState } from "react"
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

const JOIN_KEY = "ghc.challenges.joined.v1"

function loadJoined(): string[] {
  try {
    const raw = localStorage.getItem(JOIN_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.map(String) : []
  } catch {
    return []
  }
}

function saveJoined(ids: string[]) {
  try {
    localStorage.setItem(JOIN_KEY, JSON.stringify(ids.slice(0, 80)))
  } catch {
    /* */
  }
}

export function ChallengeInline({ challenge }: { challenge: ChallengeView }) {
  const [joined, setJoined] = useState(() => loadJoined().includes(challenge.id))
  const endsLabel = useMemo(() => `${challenge.days} day window`, [challenge.days])

  const onJoin = () => {
    const next = Array.from(new Set([...loadJoined(), challenge.id]))
    saveJoined(next)
    setJoined(true)
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
        {!joined ? (
          <button
            type="button"
            onClick={onJoin}
            className="rounded-full bg-rose-600 px-3 py-1.5 text-[12px] font-bold text-white"
          >
            Join challenge
          </button>
        ) : (
          <span className="rounded-full border border-rose-300 px-3 py-1.5 text-[12px] font-bold text-rose-800 dark:text-rose-200">
            Joined
          </span>
        )}
        <button
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
        </button>
      </div>
    </div>
  )
}
