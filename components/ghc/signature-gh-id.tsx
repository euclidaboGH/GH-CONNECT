"use client"

/**
 * Signature GreenHaven ID strip — same visual language across Profile, Wallet, Receive, etc.
 */

import { useMemo, useState, useCallback } from "react"
import { Copy, Check, Share2, QrCode, BadgeCheck } from "lucide-react"
import {
  getOrCreateGreenHavenId,
  formatGreenHavenIdDisplay,
} from "@/lib/domains/greenhaven-id"
import { GhIdentityQr } from "./gh-identity-qr"

export function SignatureGhIdCard({
  userId,
  displayName,
  preferredId,
  verified,
  onToast,
}: {
  userId: string
  displayName?: string
  preferredId?: string | null
  verified?: boolean
  onToast?: (msg: string, type?: string) => void
}) {
  const ghId = useMemo(
    () => getOrCreateGreenHavenId(userId, preferredId),
    [userId, preferredId]
  )
  const display = formatGreenHavenIdDisplay(ghId)
  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(display)
      setCopied(true)
      onToast?.("GH ID copied", "success")
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      onToast?.("Could not copy", "error")
    }
  }, [display, onToast])

  const share = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "GreenHaven ID", text: `${displayName || "Member"} · ${display}` })
      } else {
        await copy()
      }
    } catch {
      /* */
    }
  }, [display, displayName, copy])

  return (
    <section
      className="overflow-hidden rounded-2xl border border-emerald-700/30 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 text-white shadow-lg shadow-emerald-900/20"
      aria-label="GreenHaven ID"
    >
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/80">
            GreenHaven ID
          </p>
          <p className="mt-1 font-mono text-[22px] font-black tracking-wider text-white">
            {display}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-emerald-50/95">
            {(displayName || "Member").toUpperCase()}
            {verified ? <BadgeCheck size={14} className="text-sky-300" /> : null}
          </p>
          <p className="mt-0.5 text-[10px] font-medium text-emerald-200/70">
            Verified GreenHaven identity
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowQr((v) => !v)}
          className="rounded-xl bg-white/10 p-2.5 backdrop-blur hover:bg-white/15"
          aria-label="Show QR"
        >
          <QrCode size={22} />
        </button>
      </div>
      {showQr ? (
        <div className="flex justify-center bg-white/95 px-4 py-3">
          <GhIdentityQr greenHavenId={ghId} size={140} alt={`QR for ${display}`} />
        </div>
      ) : null}
      <div className="flex gap-2 border-t border-white/10 px-3 py-2.5">
        <button
          type="button"
          onClick={() => void copy()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/15 py-2 text-[11px] font-bold hover:bg-white/25"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={() => void share()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/15 py-2 text-[11px] font-bold hover:bg-white/25"
        >
          <Share2 size={14} /> Share
        </button>
        <button
          type="button"
          onClick={() => setShowQr((v) => !v)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald-500 py-2 text-[11px] font-bold text-white hover:bg-emerald-400"
        >
          <QrCode size={14} /> QR
        </button>
      </div>
    </section>
  )
}
