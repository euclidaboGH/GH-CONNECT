"use client"

import {
  ListOrdered,
  QrCode,
  CreditCard,
  Gauge,
  Shield,
  FileText,
  Sparkles,
} from "lucide-react"

const TOOLS = [
  { id: "utility", label: "Spend GHC", icon: Sparkles },
  { id: "tx", label: "Transactions", icon: ListOrdered },
  { id: "qr", label: "Receive / QR", icon: QrCode },
  { id: "methods", label: "Payment methods", icon: CreditCard },
  { id: "limits", label: "GHC limits", icon: Gauge },
  { id: "security", label: "Security", icon: Shield },
  { id: "statements", label: "Statements", icon: FileText },
] as const

export type WalletToolId = (typeof TOOLS)[number]["id"]

export function WalletToolsGrid({
  onSelect,
}: {
  onSelect: (id: WalletToolId) => void
}) {
  return (
    <section className="mx-3 mt-5" aria-label="Wallet tools">
      <h2 className="mb-1 px-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        More tools
      </h2>
      <p className="mb-3 px-0.5 text-[11px] leading-snug text-muted-foreground">
        Spend GHC on boosts & tools, history, statements. Pi payments stay separate.
      </p>
      <div className="grid grid-cols-3 gap-2.5">
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border/50 bg-card px-2 py-3.5 text-center shadow-[var(--gh-card-shadow)] transition hover:border-border hover:shadow-md active:scale-[0.98]"
          >
            <span className="gh-icon-tile flex h-10 w-10 items-center justify-center">
              <Icon size={18} strokeWidth={2.1} />
            </span>
            <span className="text-[10px] font-semibold leading-tight text-foreground">{label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
