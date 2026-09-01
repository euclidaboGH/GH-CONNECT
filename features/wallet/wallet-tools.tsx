"use client"

import {
  ListOrdered,
  QrCode,
  CreditCard,
  Gauge,
  Shield,
  FileText,
} from "lucide-react"

const TOOLS = [
  { id: "tx", label: "Transactions", icon: ListOrdered },
  { id: "qr", label: "Receive / QR", icon: QrCode },
  { id: "methods", label: "Payment methods", icon: CreditCard },
  { id: "limits", label: "GHC limits", icon: Gauge },
  { id: "security", label: "Security", icon: Shield },
  { id: "statements", label: "Statements", icon: FileText },
] as const

export function WalletToolsGrid({
  onSelect,
}: {
  onSelect: (id: (typeof TOOLS)[number]["id"]) => void
}) {
  return (
    <section className="mx-3 mt-4" aria-label="Wallet tools">
      <h2 className="mb-2 px-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        More tools
      </h2>
      <p className="mb-2 px-0.5 text-[10px] text-muted-foreground">
        Secondary - transactions, QR, limits, security
      </p>
      <div className="grid grid-cols-3 gap-2">
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className="flex flex-col items-center gap-1.5 rounded-[var(--gh-radius-sm)] bg-muted/50 px-2 py-3 text-center transition hover:bg-muted active:scale-[0.98]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-foreground">
              <Icon size={18} />
            </span>
            <span className="text-[10px] font-semibold leading-tight text-foreground">{label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
