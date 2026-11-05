"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { copyTextToClipboard } from "@/lib/product/essentials"

export function CopyIdButton({
  value,
  label = "Copy ID",
  className = "",
}: {
  value: string
  label?: string
  className?: string
}) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={
        className ||
        "inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted/60"
      }
      aria-label={label}
      onClick={async () => {
        const ok = await copyTextToClipboard(value)
        if (ok) {
          setDone(true)
          window.setTimeout(() => setDone(false), 1800)
          try {
            window.dispatchEvent(
              new CustomEvent("ghc:toast", {
                detail: { message: "Copied", type: "success" },
              })
            )
          } catch {
            /* */
          }
        }
      }}
    >
      {done ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
      {done ? "Copied" : label}
    </button>
  )
}
