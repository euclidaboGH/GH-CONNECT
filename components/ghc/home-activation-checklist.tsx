"use client"

/**
 * Lightweight activation checklist for Home.
 * Presentation only — completion is passed in from real data (never invented here).
 */

import { Check } from "lucide-react"
import type { ActivationChecklistResult, ActivationItem } from "@/lib/domains/adapters/home-activation-checklist"
import { navigateTo } from "@/lib/navigation/navigate"

function go(target: ActivationItem["target"]) {
  if (target === "compose") {
    try {
      window.dispatchEvent(new CustomEvent("ghc:open-compose", { detail: { kind: "post" } }))
    } catch {
      /* */
    }
    return
  }
  if (target === "home") return
  if (!navigateTo(target)) {
    try {
      window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: target }))
    } catch {
      /* */
    }
  }
}

export function HomeActivationChecklist({
  checklist,
}: {
  checklist: ActivationChecklistResult
}) {
  if (checklist.complete) return null

  return (
    <section
      className="gh-card mx-0 space-y-2.5 p-3"
      aria-label="GreenHaven setup checklist"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="gh-type-title text-[13px]">Complete your GreenHaven setup</h2>
          <p className="gh-type-meta mt-0.5 text-muted-foreground">
            {checklist.doneCount} of {checklist.total} done · based on your account
          </p>
        </div>
        <span
          className="shrink-0 rounded-full bg-emerald-600/10 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300"
          aria-label={`${checklist.percent} percent complete`}
        >
          {checklist.percent}%
        </span>
      </div>

      <ul className="space-y-1">
        {checklist.items.map((item) => (
          <li key={item.id}>
            {item.done ? (
              <div className="flex min-h-10 items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-[13px] text-muted-foreground">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"
                  aria-hidden
                >
                  <Check size={12} strokeWidth={3} />
                </span>
                <span className="line-through decoration-muted-foreground/50">{item.label}</span>
                <span className="sr-only">Completed</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => go(item.target)}
                className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left text-[13px] font-medium text-foreground transition hover:bg-muted/50 active:scale-[0.99]"
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-border bg-background"
                  aria-hidden
                />
                <span className="min-w-0 flex-1">{item.label}</span>
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  Go
                </span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
