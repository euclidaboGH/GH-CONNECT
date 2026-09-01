"use client"

import { ArrowUpRight, ArrowDownLeft, HandCoins, Plus } from "lucide-react"

export function WalletPrimaryActions({
  onSend,
  onRequest,
  onReceive,
  onAdd,
}: {
  onSend: () => void
  onRequest: () => void
  onReceive: () => void
  onAdd: () => void
}) {
  const items = [
    { id: "send", label: "Send", icon: <ArrowUpRight size={20} strokeWidth={2.25} />, onClick: onSend },
    { id: "request", label: "Request", icon: <HandCoins size={20} strokeWidth={2.25} />, onClick: onRequest },
    { id: "receive", label: "Receive", icon: <ArrowDownLeft size={20} strokeWidth={2.25} />, onClick: onReceive },
    { id: "add", label: "Get GHC", icon: <Plus size={20} strokeWidth={2.25} />, onClick: onAdd },
  ] as const

  return (
    <div className="mx-3 mt-4 grid grid-cols-4 gap-2" role="group" aria-label="Wallet actions">
      {items.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={a.onClick}
          className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-[var(--gh-radius-sm)] bg-muted/40 px-1.5 py-3 text-center transition active:scale-[0.98] hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm shadow-emerald-600/20">
            {a.icon}
          </span>
          <span className="text-[11px] font-bold tracking-wide text-foreground">{a.label}</span>
        </button>
      ))}
    </div>
  )
}
