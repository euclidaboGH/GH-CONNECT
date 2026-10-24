"use client"

/**
 * Referral share card — durable code + status from API; never invents rewards.
 * Settlement remains operator-flagged (GHC_REFERRAL_SETTLEMENT_ENABLED).
 */
import { useCallback, useEffect, useState } from "react"
import { Check, Copy, Link2, Share2, Users } from "lucide-react"
import { IdentityService } from "@/lib/identity/identity-service"
import {
  attributeReferralCode,
  fetchReferralStatus,
  type ReferralStatus,
} from "@/lib/referral/client"
import { notificationSystem } from "@/lib/notifications"

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
  const [stats, setStats] = useState<Pick<
    ReferralStatus,
    | "invitedCount"
    | "pendingRewardCount"
    | "postedRewardCount"
    | "pendingRewardGhc"
    | "postedRewardGhc"
    | "settlementEnabled"
    | "attributed"
  > | null>(null)
  const [copied, setCopied] = useState<"link" | "code" | null>(null)
  const [referrerGhId, setReferrerGhId] = useState("")
  const [referrerStatus, setReferrerStatus] = useState<
    "idle" | "submitting" | "locked" | "error"
  >("idle")
  const [referrerMessage, setReferrerMessage] = useState("")

  const load = useCallback(async () => {
    setState({ status: "loading" })
    try {
      const status = await fetchReferralStatus()
      if (!status.ok || !status.code) {
        // Fallback to code-only endpoint
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
                : String(data?.error || status.error || "Referral unavailable"),
          })
          return
        }
        setState({
          status: "ready",
          code: String(data.code),
          sharePath: String(data.sharePath || `/join?ref=${encodeURIComponent(data.code)}`),
        })
        return
      }
      setState({
        status: "ready",
        code: String(status.code),
        sharePath: String(status.sharePath || `/join?ref=${encodeURIComponent(status.code)}`),
      })
      setStats({
        invitedCount: status.invitedCount ?? 0,
        pendingRewardCount: status.pendingRewardCount ?? 0,
        postedRewardCount: status.postedRewardCount ?? 0,
        pendingRewardGhc: status.pendingRewardGhc ?? 0,
        postedRewardGhc: status.postedRewardGhc ?? 0,
        settlementEnabled: status.settlementEnabled,
        attributed: status.attributed,
      })
      if (status.attributed) {
        setReferrerStatus("locked")
        setReferrerMessage("Referral locked in.")
        try {
          window.localStorage.setItem("ghc.referral.locked", "1")
        } catch {
          /* */
        }
      }
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
      if (locked === "1" && referrerStatus !== "locked") {
        setReferrerStatus("locked")
        setReferrerMessage("Referral locked in.")
      }
    } catch {
      /* */
    }
  }, [referrerStatus])

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
      setCopied("link")
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      /* */
    }
  }

  async function copyCode() {
    if (state.status !== "ready") return
    try {
      await navigator.clipboard.writeText(state.code)
      setCopied("code")
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      /* */
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

  function shareWhatsApp() {
    if (state.status !== "ready" || !shareUrl) return
    const text = encodeURIComponent(
      `Join me on GreenHaven — invite code ${state.code}\n${shareUrl}`,
    )
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer")
  }

  async function submitReferrerGreenHavenId() {
    const value = referrerGhId.trim().toUpperCase()
    if (!value || referrerStatus === "locked" || referrerStatus === "submitting") return
    setReferrerStatus("submitting")
    setReferrerMessage("")
    try {
      const data = await attributeReferralCode({ greenHavenId: value })
      if (!data.ok) {
        setReferrerStatus("error")
        setReferrerMessage(
          String(
            data.message ||
              data.error ||
              "Could not save that GreenHaven ID. Check it and try once more.",
          ),
        )
        return
      }
      setReferrerStatus("locked")
      setReferrerMessage(String(data.message || "Referral saved. This cannot be changed."))
      try {
        window.localStorage.setItem("ghc.referral.locked", "1")
      } catch {
        /* */
      }
      try {
        notificationSystem.addNotification(
          "system",
          "Referral locked in",
          "Your inviter was recorded. Qualifying rewards post when settlement is enabled.",
          "🤝",
          { category: "system", open: "profile", kind: "referral_attributed" },
        )
      } catch {
        /* */
      }
      void load()
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
          <h3 className="text-sm font-bold text-foreground">Invite friends</h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Share your link or code. Rewards are only paid from verified membership charges when
            the operator enables settlement — we never invent balances here.
          </p>
        </div>
      </div>

      {state.status === "loading" ? (
        <p className="mt-3 text-xs text-muted-foreground">Loading your invite…</p>
      ) : state.status === "error" ? (
        <div className="mt-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {state.message}
          <button
            type="button"
            onClick={() => void load()}
            className="ml-2 font-semibold text-emerald-700 underline"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className={`mt-3 space-y-3 ${compact ? "" : ""}`}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
              <Link2 className="h-3.5 w-3.5 text-emerald-700" aria-hidden />
              <span className="font-mono text-sm font-bold tracking-wider text-emerald-900 dark:text-emerald-100">
                {state.code}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void copyCode()}
              className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-border bg-background px-2.5 text-[11px] font-semibold text-foreground hover:bg-muted/50"
            >
              {copied === "code" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === "code" ? "Code copied" : "Copy code"}
            </button>
          </div>

          {stats ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-border/50 bg-muted/20 px-2 py-2">
                <p className="text-lg font-bold tabular-nums text-foreground">{stats.invitedCount ?? 0}</p>
                <p className="text-[10px] font-medium text-muted-foreground">Invited</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 px-2 py-2">
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {stats.pendingRewardCount ?? 0}
                </p>
                <p className="text-[10px] font-medium text-muted-foreground">Pending</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 px-2 py-2">
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {stats.postedRewardCount ?? 0}
                </p>
                <p className="text-[10px] font-medium text-muted-foreground">Posted</p>
              </div>
            </div>
          ) : null}

          {stats?.settlementEnabled === false ? (
            <p className="text-[11px] leading-snug text-amber-800 dark:text-amber-200">
              Settlement is currently off on this environment. Qualifying VIP membership charges still
              queue rewards; they post when the operator enables{" "}
              <span className="font-mono text-[10px]">GHC_REFERRAL_SETTLEMENT_ENABLED</span>.
            </p>
          ) : null}

          {(stats?.pendingRewardGhc || stats?.postedRewardGhc) ? (
            <p className="text-[11px] text-muted-foreground">
              {stats.postedRewardGhc ? (
                <>
                  Posted rewards: <span className="font-semibold text-foreground">₲ {stats.postedRewardGhc}</span>
                  {stats.pendingRewardGhc ? " · " : ""}
                </>
              ) : null}
              {stats.pendingRewardGhc ? (
                <>
                  Pending: <span className="font-semibold text-foreground">₲ {stats.pendingRewardGhc}</span>
                </>
              ) : null}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex flex-1 min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted/50"
            >
              {copied === "link" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === "link" ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={() => void shareNative()}
              className="inline-flex flex-1 min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share invite
            </button>
            <button
              type="button"
              onClick={shareWhatsApp}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-emerald-600/40 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100"
            >
              WhatsApp
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-border/60 pt-3">
        <h4 className="text-xs font-semibold text-foreground">Who invited you?</h4>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          Enter their GreenHaven ID once (for example GH-1JYHGG) or use a shared invite link. Wrong IDs
          are rejected. You cannot edit after submit.
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
