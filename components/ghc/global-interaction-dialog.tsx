"use client"

import { useEffect, useRef, useState } from "react"
import { AlertCircle } from "lucide-react"
import type { GlobalInteractionRequest } from "@/lib/ui/global-interactions"

export function GlobalInteractionDialog() {
  const [request, setRequest] = useState<GlobalInteractionRequest | null>(null)
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onConfirm = (event: Event) => {
      const detail = (event as CustomEvent).detail as Omit<Extract<GlobalInteractionRequest, { kind: "confirm" }>, "kind"> | undefined
      if (!detail?.resolve) return
      setValue("")
      setRequest({ kind: "confirm", ...detail })
    }
    const onPrompt = (event: Event) => {
      const detail = (event as CustomEvent).detail as Omit<Extract<GlobalInteractionRequest, { kind: "prompt" }>, "kind"> | undefined
      if (!detail?.resolve) return
      setValue(detail.defaultValue || "")
      setRequest({ kind: "prompt", ...detail })
    }
    window.addEventListener("ghc:confirm-dialog", onConfirm)
    window.addEventListener("ghc:prompt-dialog", onPrompt)
    return () => {
      window.removeEventListener("ghc:confirm-dialog", onConfirm)
      window.removeEventListener("ghc:prompt-dialog", onPrompt)
    }
  }, [])

  useEffect(() => {
    if (request) requestAnimationFrame(() => inputRef.current?.focus())
  }, [request])

  if (!request) return null

  const close = (result: boolean | string | null) => {
    const resolver = request.resolve as (value: boolean | string | null) => void
    resolver(result)
    setRequest(null)
    setValue("")
  }

  const isPrompt = request.kind === "prompt"
  const pattern = isPrompt ? request.pattern : undefined
  const validPattern = pattern ? new RegExp(pattern).test(value) : true
  const canConfirm = !isPrompt || (value.length > 0 && validPattern)
  const danger = !isPrompt && request.danger === true

  return (
    <div className="fixed inset-0 z-[260] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="presentation">
      <button type="button" aria-label="Close dialog" className="absolute inset-0 cursor-default" onClick={() => close(isPrompt ? null : false)} />
      <div role="dialog" aria-modal="true" aria-labelledby="gh-global-dialog-title" className="relative w-full max-w-md rounded-t-[1.75rem] border border-border bg-card p-5 text-card-foreground shadow-2xl sm:rounded-[1.75rem] sm:p-6">
        <div className="flex items-start gap-3">
          {danger ? <AlertCircle size={22} className="mt-0.5 shrink-0 text-destructive" /> : null}
          <div className="min-w-0 flex-1">
            <h2 id="gh-global-dialog-title" className="text-lg font-bold tracking-tight">{request.title}</h2>
            {request.message ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{request.message}</p> : null}
          </div>
        </div>
        {isPrompt ? (
          <div className="mt-5">
            <label className="mb-2 block text-xs font-semibold text-muted-foreground">{isPrompt ? request.label || "Value" : "Value"}</label>
            <input
              ref={inputRef}
              type={isPrompt ? request.inputType || "text" : "text"}
              value={value}
              maxLength={isPrompt ? request.maxLength : undefined}
              placeholder={isPrompt ? request.placeholder : undefined}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && canConfirm) close(value); if (e.key === "Escape") close(null) }}
              className="min-h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        ) : null}
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={() => close(isPrompt ? null : false)} className="min-h-12 flex-1 rounded-full border border-border px-4 font-bold">
            {request.cancelLabel || "Cancel"}
          </button>
          <button type="button" disabled={!canConfirm} onClick={() => close(isPrompt ? value : true)} className={`min-h-12 flex-1 rounded-full px-4 font-bold text-white disabled:opacity-50 ${danger ? "bg-destructive" : "bg-primary"}`}>
            {request.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  )
}
