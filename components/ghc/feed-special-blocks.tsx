"use client"

/**
 * Renders Poll / Challenge posts as first-class feed cards
 * instead of plain preformatted text.
 */

import { BarChart3, Trophy, Clock } from "lucide-react"

export type SpecialPostKind = "poll" | "challenge" | null

export function detectSpecialPost(content: string | undefined | null): SpecialPostKind {
  const t = String(content || "").trim()
  if (/^📊\s*POLL/i.test(t) || /^POLL\b/i.test(t)) return "poll"
  if (/^🏆\s*CHALLENGE/i.test(t) || /^CHALLENGE\b/i.test(t)) return "challenge"
  return null
}

function parsePoll(content: string) {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean)
  const question =
    lines.find((l, i) => i > 0 && !/^\d+\./.test(l) && !l.startsWith("⏱") && !l.startsWith("Audience")) ||
    lines[1] ||
    "Poll"
  const options = lines
    .filter((l) => /^\d+\.\s+/.test(l))
    .map((l) => l.replace(/^\d+\.\s+/, "").trim())
    .filter(Boolean)
  const duration = lines.find((l) => l.startsWith("⏱"))?.replace(/^⏱\s*/, "") || ""
  return { question, options, duration }
}

function parseChallenge(content: string) {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean)
  const titleLine = lines.find((l) => /CHALLENGE/i.test(l)) || lines[0] || "Challenge"
  const title = titleLine.replace(/^🏆\s*CHALLENGE\s*[·•-]?\s*/i, "").trim() || "Challenge"
  const blurb = lines.find((l, i) => i > 0 && !l.startsWith("🎯") && !l.startsWith("📅") && !l.startsWith("👥")) || ""
  const goal = lines.find((l) => l.startsWith("🎯"))?.replace(/^🎯\s*/, "") || ""
  const window = lines.find((l) => l.startsWith("📅"))?.replace(/^📅\s*/, "") || ""
  return { title, blurb, goal, window }
}

export function SpecialPostBody({ content }: { content: string }) {
  const kind = detectSpecialPost(content)
  if (kind === "poll") {
    const { question, options, duration } = parsePoll(content)
    return (
      <div className="mt-1 overflow-hidden rounded-2xl border border-amber-200/90 bg-gradient-to-b from-amber-50/90 to-card dark:border-amber-900 dark:from-amber-950/40">
        <div className="flex items-center gap-2 border-b border-amber-100 px-3 py-2 dark:border-amber-900/60">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            <BarChart3 size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">Poll</p>
            {duration ? (
              <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock size={10} /> {duration}
              </p>
            ) : null}
          </div>
        </div>
        <div className="px-3 py-3">
          <p className="text-[15px] font-bold leading-snug text-foreground">{question}</p>
          <div className="mt-3 space-y-2">
            {options.map((opt, i) => (
              <button
                key={i}
                type="button"
                className="flex w-full items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-left text-[13px] font-medium transition hover:border-amber-400 hover:bg-amber-50/50 active:scale-[0.99] dark:hover:bg-amber-950/30"
                onClick={() => {
                  try {
                    window.dispatchEvent(
                      new CustomEvent("ghc:poll-vote", { detail: { optionIndex: i, option: opt } }),
                    )
                  } catch {
                    /* */
                  }
                }}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">{opt}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">Tap an option to respond · results improve as voting goes live</p>
        </div>
      </div>
    )
  }

  if (kind === "challenge") {
    const { title, blurb, goal, window } = parseChallenge(content)
    return (
      <div className="mt-1 overflow-hidden rounded-2xl border border-rose-200/90 bg-gradient-to-br from-rose-600 via-rose-500 to-amber-500 text-white shadow-md dark:border-rose-900">
        <div className="px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <Trophy size={18} />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Challenge</p>
              <p className="text-[15px] font-bold leading-tight">{title}</p>
            </div>
          </div>
          {blurb ? <p className="mt-2 text-[12px] leading-relaxed text-white/90">{blurb}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {goal ? (
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm">{goal}</span>
            ) : null}
            {window ? (
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm">{window}</span>
            ) : null}
          </div>
          <button
            type="button"
            className="mt-3 w-full rounded-xl bg-white py-2.5 text-[13px] font-bold text-rose-700 transition active:scale-[0.99]"
            onClick={() => {
              try {
                window.dispatchEvent(new CustomEvent("ghc:open-challenge"))
              } catch {
                /* */
              }
            }}
          >
            Join challenge
          </button>
        </div>
      </div>
    )
  }

  return null
}

export default SpecialPostBody
