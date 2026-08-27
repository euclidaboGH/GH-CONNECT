"use client"

/**
 * Phase D4 — Receive GHC identity + QR (no money movement).
 * Transfer still happens only via SendGhcFlow → economy.sendGhcToUser.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Check,
  Copy,
  Share2,
  ScanLine,
  X,
  User,
  AlertCircle,
} from "lucide-react"
import { GhcCoinIcon } from "./ghc-coin-icon"
import { isSafeReceiveUri } from "@/lib/domains/ghc-wallet-ux"
import {
  getOrCreateGreenHavenId,
  formatGreenHavenIdDisplay,
  normalizeGreenHavenId,
  resolveUserIdFromGreenHavenId,
  isValidGreenHavenIdFormat,
  ensureGreenHavenIdServer,
  resolveGreenHavenIdServer,
} from "@/lib/domains/greenhaven-id"
import {
  buildReceivePayload,
  parseReceivePayload,
} from "@/lib/domains/ghc-receive-payload"
import { encodeQrSvg } from "@/lib/qr-lite"
import { collectSendRecipients, type SendRecipient } from "./send-ghc-flow"

function formatGhc(n: number) {
  if (!Number.isFinite(n)) return "0"
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export type ReceiveGhcFlowProps = {
  open: boolean
  onClose: () => void
  availableBalance: number
  currentUserId?: string
  displayName?: string
  /** Handoff into Send with resolved recipient */
  onSendToRecipient: (recipient: SendRecipient) => void
}

export function ReceiveGhcFlow({
  open,
  onClose,
  availableBalance,
  currentUserId = "current-user",
  displayName,
  onSendToRecipient,
}: ReceiveGhcFlowProps) {
  const [toast, setToast] = useState<string | null>(null)
  const [manualId, setManualId] = useState("")
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [resolved, setResolved] = useState<SendRecipient | null>(null)
  const [scanMsg, setScanMsg] = useState<string | null>(null)
  const [mode, setMode] = useState<"receive" | "lookup">("receive")

  const [ghId, setGhId] = useState(() => getOrCreateGreenHavenId(currentUserId))
  const [idSource, setIdSource] = useState<"local_fallback" | "database" | "memory">("local_fallback")

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const row = await ensureGreenHavenIdServer(currentUserId)
      if (cancelled) return
      setGhId(row.publicId)
      setIdSource(row.source === "database" || row.source === "memory" ? row.source : "local_fallback")
    })()
    return () => {
      cancelled = true
    }
  }, [open, currentUserId])

  const payload = useMemo(() => {
    try {
      return buildReceivePayload(ghId)
    } catch {
      return ""
    }
  }, [ghId])

  const qrSvg = useMemo(() => {
    if (!payload) return ""
    try {
      return encodeQrSvg(payload, 5)
    } catch {
      return ""
    }
  }, [payload])

  useEffect(() => {
    if (!open) {
      setToast(null)
      setManualId("")
      setLookupError(null)
      setResolved(null)
      setScanMsg(null)
      setMode("receive")
    }
  }, [open])

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }

  const copyId = async () => {
    const text = formatGreenHavenIdDisplay(ghId)
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        showToast("GreenHaven ID copied")
        return
      }
    } catch {
      /* fall through */
    }
    showToast("Could not copy automatically. Press and hold to copy your GreenHaven ID.")
  }

  const shareId = async () => {
    const text = `My GreenHaven ID is ${formatGreenHavenIdDisplay(ghId)}\n\nYou can use this ID to send me GHC on GreenHaven.`
    try {
      if (navigator.share) {
        await navigator.share({ title: "GreenHaven ID", text })
        return
      }
    } catch {
      /* user cancelled or unsupported */
    }
    try {
      await navigator.clipboard?.writeText(text)
      showToast("Share text copied")
    } catch {
      showToast("Sharing isn't available. Copy your GreenHaven ID instead.")
    }
  }

  const resolveId = useCallback(
    (raw: string) => {
      setLookupError(null)
      setResolved(null)
      const parsed = parseReceivePayload(raw)
      if (!parsed.ok) {
        setLookupError(parsed.message)
        return
      }
      const id = parsed.payload.greenHavenId
      if (id === getOrCreateGreenHavenId(currentUserId)) {
        setLookupError("That's your own GreenHaven ID.")
        return
      }
      const directory = collectSendRecipients().map((r) => ({
        id: r.id,
        name: r.name,
        greenHavenId: getOrCreateGreenHavenId(r.id),
      }))
      // Also register derived ids for directory members
      for (const r of directory) {
        getOrCreateGreenHavenId(r.id)
      }
      void (async () => {
        const server = await resolveGreenHavenIdServer(id, directory)
        if (server) {
          if (server.userId === currentUserId) {
            setLookupError("That's your own GreenHaven ID.")
            return
          }
          setResolved({
            id: server.userId,
            name: server.displayName || server.publicId,
            username: server.publicId,
          })
          return
        }
        const hit = resolveUserIdFromGreenHavenId(id, directory)
        if (!hit) {
          setResolved({
            id: id,
            name: id,
            username: id,
          })
          setLookupError(null)
          return
        }
        if (hit.userId === currentUserId) {
          setLookupError("That's your own GreenHaven ID.")
          return
        }
        setResolved({
          id: hit.userId,
          name: hit.name,
          username: hit.greenHavenId,
        })
      })()
    },
    [currentUserId]
  )

  const tryScan = async () => {
    setScanMsg(null)
    // BarcodeDetector is optional; do not fake a camera UI
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector
    if (!BD) {
      setScanMsg(
        "QR scanning isn't available on this device/browser. You can enter the GreenHaven ID manually."
      )
      setMode("lookup")
      return
    }
    try {
      // Permission probe only — full camera stream UI deferred when unsupported paths dominate
      const stream = await navigator.mediaDevices?.getUserMedia?.({
        video: { facingMode: "environment" },
      })
      if (!stream) {
        setScanMsg(
          "QR scanning isn't available on this device/browser. You can enter the GreenHaven ID manually."
        )
        setMode("lookup")
        return
      }
      // Stop immediately — full continuous scan UI not required when environment is limited
      stream.getTracks().forEach((t) => t.stop())
      setScanMsg(
        "Camera is available, but continuous scan isn't enabled in this build. Enter the GreenHaven ID or paste a receive code."
      )
      setMode("lookup")
    } catch {
      setScanMsg(
        "Camera permission denied or unavailable. Enter the GreenHaven ID manually."
      )
      setMode("lookup")
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Receive GHC"
    >
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-[1] flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Back"
            onClick={() => {
              if (mode === "lookup") setMode("receive")
              else onClose()
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">
              {mode === "receive" ? "Receive GHC" : "Send using ID"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {mode === "receive"
                ? "Share your GreenHaven ID or QR code to receive GHC"
                : "Resolve a GreenHaven ID, then continue to Send"}
            </p>
          </div>
          <button type="button" className="rounded-full p-2 hover:bg-muted" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {mode === "receive" && (
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Receive GreenHaven Coin securely from another GreenHaven user. Opening this screen
                does not move GHC.
              </p>

              {/* Identity */}
              <div className="rounded-2xl border border-border bg-muted/20 px-4 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <User size={22} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Your GreenHaven ID
                    </p>
                    <p
                      className="truncate text-lg font-bold tracking-wide text-foreground"
                      aria-label={`GreenHaven ID: ${formatGreenHavenIdDisplay(ghId)}`}
                    >
                      {formatGreenHavenIdDisplay(ghId)}
                    </p>
                    {idSource !== "local_fallback" && (
                      <p className="text-[10px] font-medium text-emerald-700">Verified identity</p>
                    )}
                    {displayName && (
                      <p className="truncate text-[11px] text-muted-foreground">{displayName}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void copyId()}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-sm font-bold text-foreground"
                >
                  <Copy size={16} aria-hidden />
                  Copy ID
                </button>
              </div>

              {/* QR */}
              <div className="rounded-2xl border border-border bg-card px-4 py-4 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Your QR code
                </p>
                <div className="mx-auto mt-3 flex max-w-[240px] items-center justify-center rounded-xl border border-border bg-white p-3">
                  {qrSvg ? (
                    <div
                      className="mx-auto"
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                  ) : (
                    <p className="py-8 text-xs text-muted-foreground">QR unavailable — use your ID</p>
                  )}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Scan or share this code so someone can send GHC to you. The code does not authorize a
                  transfer by itself.
                </p>
                <p className="sr-only">GreenHaven ID: {formatGreenHavenIdDisplay(ghId)}</p>
              </div>

              {/* Optional balance context */}
              <p className="text-center text-[11px] text-muted-foreground">
                Available balance{" "}
                <span className="font-semibold text-foreground">{formatGhc(availableBalance)} GHC</span>
                <span className="text-muted-foreground"> · unchanged by Receive</span>
              </p>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void shareId()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white"
                >
                  <Share2 size={16} aria-hidden />
                  Share ID
                </button>
                <button
                  type="button"
                  onClick={() => void tryScan()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground"
                >
                  <ScanLine size={16} aria-hidden />
                  Scan QR / Enter ID
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-xl py-2 text-sm font-semibold text-muted-foreground"
                >
                  Done
                </button>
              </div>
              {scanMsg && (
                <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground" role="status">
                  {scanMsg}
                </p>
              )}
            </div>
          )}

          {mode === "lookup" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="gh-lookup">
                  Enter GreenHaven ID or paste receive code
                </label>
                <input
                  id="gh-lookup"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  placeholder="GH-XXXXXX or ghc://receive?..."
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
                  autoComplete="off"
                />
              </div>
              <button
                type="button"
                onClick={() => resolveId(manualId)}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white"
              >
                Continue
              </button>
              {lookupError && (
                <p className="flex items-start gap-2 text-xs text-rose-600" role="alert">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  {lookupError}
                </p>
              )}
              {resolved && (
                <div className="rounded-2xl border border-border bg-muted/20 px-4 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    You&apos;re sending to
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                      <User size={20} className="text-muted-foreground" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-foreground">{resolved.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatGreenHavenIdDisplay(resolved.username || resolved.id)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSendToRecipient(resolved)
                      onClose()
                    }}
                    className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white"
                  >
                    Continue to Send
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {toast && (
          <div
            className="pointer-events-none absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-emerald-800 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg"
            role="status"
          >
            <Check size={12} />
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}
