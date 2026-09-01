"use client"

/**
 * GreenHaven ID — central identity card.
 * Share · Copy · QR · Scan · Find · Send GHC · Open profile
 * Never shows wallet balance.
 */

import { useCallback, useMemo, useState } from "react"
import {
  Copy,
  Check,
  Share2,
  QrCode,
  ScanLine,
  Search,
  Send,
  UserRound,
  X,
} from "lucide-react"
import {
  getOrCreateGreenHavenId,
  formatGreenHavenIdDisplay,
  isValidGreenHavenIdFormat,
  normalizeGreenHavenId,
  resolveUserIdFromGreenHavenId,
} from "@/lib/domains/greenhaven-id"
import { buildReceivePayload, parseReceivePayload } from "@/lib/domains/ghc-receive-payload"
import { GhcCoinIcon } from "./ghc-coin-icon"
import { GhIdentityQr } from "./gh-identity-qr"

export type GreenHavenIdentityCardProps = {
  userId: string
  displayName?: string
  preferredId?: string | null
  /** Compact embed on profile */
  compact?: boolean
  onSendGhc?: (greenHavenId: string) => void
  onOpenProfile?: (userId: string, greenHavenId: string) => void
  onFindUser?: (greenHavenId: string) => void
  onToast?: (message: string, type: "success" | "error" | "info") => void
}

export function GreenHavenIdentityCard({
  userId,
  displayName,
  preferredId,
  compact = false,
  onSendGhc,
  onOpenProfile,
  onFindUser,
  onToast,
}: GreenHavenIdentityCardProps) {
  const ghId = useMemo(
    () => getOrCreateGreenHavenId(userId, preferredId),
    [userId, preferredId]
  )
  const display = formatGreenHavenIdDisplay(ghId)
  const payload = useMemo(() => {
    try {
      return buildReceivePayload(ghId)
    } catch {
      return ghId
    }
  }, [ghId])

  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [showScan, setShowScan] = useState(false)
  const [scanInput, setScanInput] = useState("")
  const [findOpen, setFindOpen] = useState(false)
  const [findInput, setFindInput] = useState("")


  const copyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(display)
      setCopied(true)
      onToast?.("GreenHaven ID copied", "success")
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      onToast?.("Could not copy", "error")
    }
  }, [display, onToast])

  const shareId = useCallback(async () => {
    const text = `${displayName || "GreenHaven"} · ${display}`
    try {
      if (navigator.share) {
        await navigator.share({ title: "GreenHaven ID", text, url: payload })
        return
      }
      await navigator.clipboard.writeText(`${text}\n${payload}`)
      onToast?.("GreenHaven ID ready to share", "success")
    } catch {
      onToast?.("Share cancelled", "info")
    }
  }, [display, displayName, payload, onToast])

  const handleParsed = useCallback(
    (raw: string) => {
      const parsed = parseReceivePayload(raw)
      if (!parsed.ok) {
        onToast?.(parsed.message, "error")
        return
      }
      const id = parsed.payload.greenHavenId
      const resolved = resolveUserIdFromGreenHavenId(id, [
        { id: userId, name: displayName, greenHavenId: ghId },
      ])
      onFindUser?.(id)
      try {
        window.dispatchEvent(
          new CustomEvent("ghc:greenhaven-id", {
            detail: { action: "resolve", greenHavenId: id, userId: resolved?.userId },
          })
        )
      } catch { /* */ }
      if (resolved?.userId && onOpenProfile) {
        onOpenProfile(resolved.userId, id)
      } else if (resolved?.userId === userId) {
        onOpenProfile?.(userId, id)
      } else {
        onToast?.(`${id} · directory lookup when online`, "info")
      }
      setShowScan(false)
      setFindOpen(false)
      setScanInput("")
      setFindInput("")
    },
    [userId, ghId, displayName, onFindUser, onOpenProfile, onToast]
  )

  const actions = [
    {
      id: "copy",
      label: copied ? "Copied" : "Copy",
      icon: copied ? <Check size={16} /> : <Copy size={16} />,
      onClick: () => void copyId(),
    },
    {
      id: "share",
      label: "Share",
      icon: <Share2 size={16} />,
      onClick: () => void shareId(),
    },
    {
      id: "qr",
      label: "QR",
      icon: <QrCode size={16} />,
      onClick: () => setShowQr(true),
    },
    {
      id: "scan",
      label: "Scan",
      icon: <ScanLine size={16} />,
      onClick: () => setShowScan(true),
    },
    {
      id: "find",
      label: "Find",
      icon: <Search size={16} />,
      onClick: () => setFindOpen(true),
    },
    {
      id: "send",
      label: "Send GHC",
      icon: <Send size={16} />,
      onClick: () => {
        try {
          window.dispatchEvent(
            new CustomEvent("ghc:greenhaven-id", {
              detail: { action: "send-ghc", greenHavenId: ghId, userId },
            })
          )
        } catch { /* */ }
        onSendGhc?.(ghId)
      },
    },
    {
      id: "profile",
      label: "Profile",
      icon: <UserRound size={16} />,
      onClick: () => onOpenProfile?.(userId, ghId),
    },
  ] as const

  return (
    <section
      className={
        compact
          ? "rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 p-3 dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-teal-950/20"
          : "rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-teal-50/60 p-4 shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/50 dark:to-teal-950/30"
      }
      aria-label="GreenHaven ID"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/25">
          <GhcCoinIcon size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800/80 dark:text-emerald-300/80">
            GreenHaven ID
          </p>
          <p className="mt-0.5 font-mono text-lg font-bold tracking-wider text-foreground sm:text-xl">
            {display}
          </p>
          {displayName ? (
            <p className="truncate text-[12px] text-muted-foreground">{displayName}</p>
          ) : null}
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            Verified GreenHaven identity · safe to share · never your balance
          </p>
        </div>
      </div>

      <div
        className={`mt-3 grid gap-1.5 ${compact ? "signature-gh-id grid-cols-4" : "grid-cols-4 sm:grid-cols-7"}`}
        role="group"
        aria-label="GreenHaven ID actions"
      >
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={a.onClick}
            className="flex flex-col items-center gap-1 rounded-xl border border-border/80 bg-card/90 px-1 py-2 text-center transition hover:border-emerald-300 hover:bg-emerald-50/50 active:scale-[0.98] dark:hover:bg-emerald-950/40"
          >
            <span className="text-emerald-700 dark:text-emerald-300">{a.icon}</span>
            <span className="text-[9px] font-bold leading-tight text-foreground">{a.label}</span>
          </button>
        ))}
      </div>
      {!compact ? (
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Your universal GreenHaven identity · share, find, and receive without exposing balances
        </p>
      ) : null}

      {/* QR modal */}
      {showQr && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={() => setShowQr(false)} />
          <div className="relative z-[91] w-full max-w-xs rounded-3xl border border-border bg-card p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold">Your QR · {display}</p>
              <button type="button" onClick={() => setShowQr(false)} className="rounded-full p-1.5 hover:bg-muted" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="mx-auto flex justify-center">
              <GhIdentityQr greenHavenId={ghId} size={200} alt={`QR for ${display}`} />
            </div>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Others can scan to find you or send GHC · no balance is encoded
            </p>
            <button
              type="button"
              onClick={() => void copyId()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-2.5 text-sm font-bold text-white"
            >
              <Copy size={16} /> Copy ID
            </button>
          </div>
        </div>
      )}

      {/* Scan / paste */}
      {showScan && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" role="dialog">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={() => setShowScan(false)} />
          <div className="relative z-[91] w-full max-w-md rounded-t-3xl border border-border bg-card p-4 shadow-2xl sm:rounded-3xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold">Scan or paste GreenHaven ID</p>
              <button type="button" onClick={() => setShowScan(false)} className="rounded-full p-1.5 hover:bg-muted" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Camera scan uses paste of QR content on web · paste GH-XXXXXX or ghc://receive link
            </p>
            <textarea
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              rows={3}
              placeholder="GH-AB72KD or ghc://receive?v=1&id=..."
              className="w-full rounded-2xl border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            <button
              type="button"
              onClick={() => handleParsed(scanInput)}
              className="mt-3 w-full rounded-2xl bg-emerald-600 py-2.5 text-sm font-bold text-white"
            >
              Resolve identity
            </button>
          </div>
        </div>
      )}

      {/* Find */}
      {findOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" role="dialog">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={() => setFindOpen(false)} />
          <div className="relative z-[91] w-full max-w-md rounded-t-3xl border border-border bg-card p-4 shadow-2xl sm:rounded-3xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold">Find by GreenHaven ID</p>
              <button type="button" onClick={() => setFindOpen(false)} className="rounded-full p-1.5 hover:bg-muted" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <input
              value={findInput}
              onChange={(e) => setFindInput(e.target.value)}
              placeholder="GH-AB72KD"
              className="w-full rounded-2xl border border-border bg-background px-3 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            <button
              type="button"
              onClick={() => {
                const n = normalizeGreenHavenId(findInput)
                if (!isValidGreenHavenIdFormat(n)) {
                  onToast?.("Enter a valid GH-XXXXXX ID", "error")
                  return
                }
                handleParsed(n)
              }}
              className="mt-3 w-full rounded-2xl bg-emerald-600 py-2.5 text-sm font-bold text-white"
            >
              Find user
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
