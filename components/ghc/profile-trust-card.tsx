"use client"

import { useCallback, useEffect, useState } from "react"
import type { FormEvent } from "react"
import { ShieldCheck, Scale, RefreshCw } from "lucide-react"

type TrustResponse = { ok?: boolean; dimensions?: Record<string, number>; eventCount?: number }
type Appeal = { id: string; category: string; status: string; created_at?: string; resolution_note?: string }

const DIMENSIONS: Array<[string, string]> = [
  ["helpfulness", "Helpfulness"],
  ["reliability", "Reliability"],
  ["safety", "Safety"],
  ["expertise", "Expertise"],
  ["transaction_trust", "Transaction trust"],
]

export function ProfileTrustCard() {
  const [trust, setTrust] = useState<TrustResponse | null>(null)
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [appealsLoaded, setAppealsLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAppealForm, setShowAppealForm] = useState(false)
  const [category, setCategory] = useState("incorrect_penalty")
  const [targetEventId, setTargetEventId] = useState("")
  const [explanation, setExplanation] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [trustResponse, appealResponse] = await Promise.all([
        fetch("/api/social/trust", { cache: "no-store" }),
        fetch("/api/social/reputation/appeals", { cache: "no-store" }),
      ])
      const [trustData, appealData] = await Promise.all([
        trustResponse.json().catch(() => null) as Promise<TrustResponse | null>,
        appealResponse.json().catch(() => null) as Promise<{ ok?: boolean; appeals?: Appeal[] } | null>,
      ])
      if (trustResponse.ok && trustData?.ok) setTrust(trustData)
      if (appealResponse.ok && appealData?.ok) {
        setAppeals(Array.isArray(appealData.appeals) ? appealData.appeals : [])
        setAppealsLoaded(true)
      }
    } catch {
      // Preserve the last durable snapshot; this panel is informational only.
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function submitAppeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (explanation.trim().length < 20 || saving) return
    setSaving(true)
    setMessage("")
    try {
      const response = await fetch("/api/social/reputation/appeals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, targetEventId: targetEventId.trim() || undefined, explanation: explanation.trim() }),
      })
      const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string }
      if (!response.ok || result.ok !== true) throw new Error(result.error || "APPEAL_SUBMIT_FAILED")
      setMessage("Appeal submitted. You can track its status below.")
      setExplanation("")
      setTargetEventId("")
      setShowAppealForm(false)
      await load()
    } catch {
      setMessage("Could not submit the appeal. Please check your connection and try again.")
    } finally { setSaving(false) }
  }

  return (
    <section className="mt-4 w-full px-4" aria-label="Trust dimensions and appeals">
      <div className="rounded-[1.25rem] border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-700 dark:text-sky-300">
            <ShieldCheck size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-foreground">Trust & reputation</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Separate evidence dimensions, not one universal score</p>
              </div>
              <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh trust dimensions" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-50">
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} aria-hidden="true" />
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {DIMENSIONS.map(([key, label]) => {
                const hasTrust = Boolean(trust?.ok)
                const score = Number(trust?.dimensions?.[key]) || 0
                const ratio = Math.min(1, Math.abs(score) / 1000)
                return (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-foreground">{label}</span>
                      <span className="tabular-nums text-muted-foreground">{hasTrust ? `${score > 0 ? "+" : ""}${score}` : "—"}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${score < 0 ? "bg-amber-500" : "bg-sky-500"}`} style={{ width: `${hasTrust ? Math.round(ratio * 100) : 0}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
              {trust?.ok ? "Only verified, source-linked events affect these dimensions. They do not automatically grant money, membership or privileges." : "Verified trust data is temporarily unavailable; no score is inferred."}
            </p>
            <div className="mt-4 border-t border-border/50 pt-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-foreground">Appeals</p>
                <button type="button" onClick={() => setShowAppealForm((value) => !value)} className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted">
                  <Scale size={13} aria-hidden="true" />Contest a decision
                </button>
              </div>
              {showAppealForm ? (
                <form onSubmit={submitAppeal} className="mt-3 space-y-2">
                  <label className="block text-[11px] font-semibold text-muted-foreground">
                    Reason category
                    <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground">
                      <option value="incorrect_penalty">Incorrect penalty</option>
                      <option value="wrong_identity">Wrong identity</option>
                      <option value="duplicate_event">Duplicate event</option>
                      <option value="context_missing">Missing context</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="block text-[11px] font-semibold text-muted-foreground">
                    Event ID (optional)
                    <input value={targetEventId} onChange={(event) => setTargetEventId(event.target.value)} maxLength={256} className="mt-1 min-h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground" placeholder="Paste the event ID if you have it" />
                  </label>
                  <label className="block text-[11px] font-semibold text-muted-foreground">
                    Explain what should be reviewed
                    <textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} minLength={20} maxLength={3000} rows={4} required className="mt-1 w-full rounded-xl border border-border/60 bg-background p-3 text-sm text-foreground" placeholder="Describe the context or evidence that may have been missed…" />
                  </label>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowAppealForm(false)} className="rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted">Cancel</button>
                    <button type="submit" disabled={saving || explanation.trim().length < 20} className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">{saving ? "Submitting…" : "Submit appeal"}</button>
                  </div>
                </form>
              ) : null}
              {message ? <p role="status" className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
              {appeals.length ? (
                <div className="mt-3 space-y-2">
                  {appeals.slice(0, 3).map((appeal) => (
                    <div key={appeal.id} className="flex items-start justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold capitalize text-foreground">{appeal.category.replaceAll("_", " ")}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{appeal.id.slice(0, 8)}…</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-border/60 px-2 py-1 text-[10px] font-bold capitalize text-foreground">{appeal.status.replaceAll("_", " ")}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-muted-foreground">{appealsLoaded ? "No reputation appeals on record." : "Appeal history is temporarily unavailable."}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

