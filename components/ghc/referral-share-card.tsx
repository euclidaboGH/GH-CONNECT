"use client"

/**
 * Referral share card — loads durable code from API; never invents rewards.
 * Settlement remains server-flagged; this UI is share + status only.
 */
import { useCallback, useEffect, useState } from "react"
import { Check, Copy, Link2, Users } from "lucide-react"
import { IdentityService } from "@/lib/identity/identity-service"

type CodeState =
  | { status: "loading" }
  | { status: "ready"; code: string; sharePath: string }
  | { status: "error"; message: string }

export function ReferralShareCard({
  compact = false,
  className = "",
}: {
  compact?: boolean
  className?: string
}) {
  const [state, setState] = useState<CodeState>({ status: "loading" })
  const [copied, setCopied] = useState(false)
  const [referrerGhId, setReferrerGhId] = useState("")
  const [referrerStatus, setReferrerStatus] = useState<
    "idle" | "submitting" | "locked" | "error"
  >("idle")
  const [referrerMessage, setReferrerMessage] = useState("")

  const load = useCallback(async () => {
    setState({ status: "loading" })
    try {
      const res = await fetch("/api/referral/code", {
        credentials: "include",
        cache: "no-store",
        headers: { ...(IdentityService.getAuthHeaders?.() || {}), Accept: "application/json" },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok || !data?.code) {
        setState({
          status: "error",
          message:
            res.status === 401
              ? "Sign in to get your referral link"
              : String(data?.error || "Referral unavailable"),
        })
        return
      }
      setState({
        status: "ready",
        code: String(data.code),
        sharePath: String(data.sharePath || `/join?ref=${encodeURIComponent(data.code)}`),
      })
    } catch {
      setState({ status: "error", message: "Network error loading referral" })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      const locked = window.localStorage.getItem("ghc.referral.locked")
      if (locked === "1") {
        setReferrerStatus("locked")
        setReferrerMessage("Referral locked in.")
      }
    } catch {
      /* */
    }
  }, [])

  const shareUrl =
    state.status === "ready"
      ? typeof window !== "undefined"
        ? `${window.location.origin}${state.sharePath}`
        : state.sharePath
      : ""

  async function copyLink() {
    if (state.status !== "ready" || !shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  async function shareNative() {
    if (state.status !== "ready" || !shareUrl) return
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join GreenHaven",
          text: `Join me on GreenHaven with my invite code ${state.code}`,
          url: shareUrl,
        })
      } else {
        await copyLink()
      }
    } catch {
      /* user cancel */
    }
  }

  async function submitReferrerGreenHavenId() {
    const value = referrerGhId.trim().toUpperCase()
    if (!value || referrerStatus === "locked" || referrerStatus === "submitting") return
    setReferrerStatus("submitting")
    setReferrerMessage("")
    try {
      const res = await fetch("/api/referral/attribute", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(IdentityService.getAuthHeaders?.() || {}),
        },
        body: JSON.stringify({ greenHavenId: value }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.ok === false) {
        setReferrerStatus("error")
        setReferrerMessage(
          String(
            data?.message ||
              data?.error ||
              "Could not save that GreenHaven ID. Check it and try once more."
          )
        )
        return
      }
      setReferrerStatus("locked")
      setReferrerMessage(
        String(data?.message || "Referral saved. This cannot be changed.")
      )
      try {
        window.localStorage.setItem("ghc.referral.locked", "1")
      } catch {
        /* */
      }
    } catch {
      setReferrerStatus("error")
      setReferrerMessage("Network error — try again.")
    }
  }

  return (
    <section
      className={`rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-background p-4 shadow-sm ${className}`}
      aria-label="Referral invite"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700">
          <Users className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">Invite friends</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Share your link. A reward is only issued after a qualifying VIP membership paid in GHC —
            calculated as 5% of the amount charged.
          </p>
        </div>
      </div>

      {state.status === "loading" && (
        <div className="mt-3 h-10 animate-pulse rounded-xl bg-muted/60" aria-hidden />
      )}

      {state.status === "error" && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-400" role="status">
          {state.message}
        </p>
      )}

      {state.status === "ready" && (
        <div className={`mt-3 space-y-2 ${compact ? "" : ""}`}>
          <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-background/80 px-3 py-2">
            <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <code className="min-w-0 flex-1 truncate text-xs font-semibold tracking-wide text-foreground">
              {state.code}
            </code>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted/50"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={() => void shareNative()}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
            >
              Share invite
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-border/60 pt-3">
        <h4 className="text-xs font-semibold text-foreground">Who invited you?</h4>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          Enter their GreenHaven ID once (for example GH-1JYHGG). Wrong IDs are rejected. You cannot edit after submit.
        </p>
        {referrerStatus === "locked" ? (
          <p className="mt-2 text-xs font-medium text-emerald-700" role="status">
            {referrerMessage || "Referral locked in."}
          </p>
        ) : (
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={referrerGhId}
              onChange={(e) => setReferrerGhId(e.target.value)}
              placeholder="GH-XXXXXXXX"
              disabled={referrerStatus === "submitting"}
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium uppercase tracking-wide outline-none focus:ring-2 focus:ring-emerald-500/40"
              autoComplete="off"
              maxLength={40}
            />
            <button
              type="button"
              onClick={() => void submitReferrerGreenHavenId()}
              disabled={referrerStatus === "submitting" || !referrerGhId.trim()}
              className="shrink-0 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {referrerStatus === "submitting" ? "Saving…" : "Submit once"}
            </button>
          </div>
        )}
        {referrerStatus === "error" && referrerMessage ? (
          <p className="mt-1.5 text-[11px] text-red-600" role="alert">
            {referrerMessage}
          </p>
        ) : null}
      </div>
    </section>
  )
}
