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
    <div className="mx-3 mt-3" role="group" aria-label="Wallet actions">
      <div className="grid grid-cols-4 gap-2 rounded-2xl border border-border/70 bg-card p-2 shadow-sm">
        {items.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={a.onClick}
            className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-2.5 text-center transition hover:bg-muted/50 active:scale-[0.97]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md shadow-emerald-600/25">
              {a.icon}
            </span>
            <span className="text-[11px] font-bold tracking-wide text-foreground">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
