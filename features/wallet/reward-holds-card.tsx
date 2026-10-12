"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { AlertTriangle, ChevronDown, RefreshCw, Scale } from "lucide-react"

type Hold = { id: string; source_event_id: string; reason_code: string; status: string; created_at?: string }
type Appeal = { id: string; source_event_id: string; category: string; status: string; created_at?: string; resolution_note?: string }

const REASONS: Record<string, string> = {
  velocity: "Activity-rate review",
  self_dealing: "Self-dealing check",
  sybil_suspected: "Account-integrity review",
  provider_mismatch: "Provider verification mismatch",
  manual_review: "Manual review",
  policy_limit: "Eligibility or policy limit",
}

export function RewardHoldsAppealsCard() {
  const [holds, setHolds] = useState<Hold[]>([])
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Hold | null>(null)
  const [sourceEventId, setSourceEventId] = useState("")
  const [category, setCategory] = useState("false_positive_hold")
  const [explanation, setExplanation] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [holdResponse, appealResponse] = await Promise.all([
        fetch("/api/economy/rewards/holds", { cache: "no-store" }),
        fetch("/api/economy/rewards/appeals", { cache: "no-store" }),
      ])
      const [holdData, appealData] = await Promise.all([
        holdResponse.json().catch(() => null) as Promise<{ ok?: boolean; holds?: Hold[] } | null>,
        appealResponse.json().catch(() => null) as Promise<{ ok?: boolean; appeals?: Appeal[] } | null>,
      ])
      if (holdResponse.ok && holdData?.ok) setHolds(Array.isArray(holdData.holds) ? holdData.holds : [])
      if (appealResponse.ok && appealData?.ok) setAppeals(Array.isArray(appealData.appeals) ? appealData.appeals : [])
      setLoaded(Boolean(holdResponse.ok && holdData?.ok && appealResponse.ok && appealData?.ok))
    } catch { setLoaded(false) } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  function startAppeal(hold?: Hold) {
    setSelected(hold || null)
    setSourceEventId(hold?.source_event_id || "")
    setCategory(hold ? "false_positive_hold" : "other")
    setExplanation("")
    setMessage("")
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (explanation.trim().length < 20 || !sourceEventId.trim() || saving) return
    setSaving(true)
    setMessage("")
    try {
      const response = await fetch("/api/economy/rewards/appeals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceEventId: sourceEventId.trim(), category, explanation: explanation.trim() }),
      })
      const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string }
      if (!response.ok || result.ok !== true) throw new Error(result.error || "APPEAL_SUBMIT_FAILED")
      setMessage("Appeal submitted. It does not automatically release or change wallet funds.")
      setSelected(null)
      setSourceEventId("")
      setExplanation("")
      await load()
    } catch { setMessage("Could not submit this appeal. Check whether an appeal already exists for this event.") }
    finally { setSaving(false) }
  }

  return (
    <section className="mx-3 mt-4 rounded-2xl border border-border/60 bg-card p-3.5" aria-label="Reward holds and appeals">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2"><AlertTriangle size={17} className="text-amber-600" aria-hidden="true" /><div><h2 className="text-sm font-bold text-foreground">Reward reviews</h2><p className="text-[10px] text-muted-foreground">Holds, reasons and appeals</p></div></div>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh reward reviews" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""} aria-hidden="true" /></button>
      </div>
      {!loaded && !loading ? <p className="mt-3 text-xs text-muted-foreground">Reward review history is temporarily unavailable.</p> : null}
      {loaded && holds.length === 0 ? <p className="mt-3 text-xs text-muted-foreground">No reward risk holds on record.</p> : null}
      {holds.slice(0, 5).map((hold) => <div key={hold.id} className="mt-3 flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2"><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-foreground">{REASONS[hold.reason_code] || "Reward review"}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{hold.status.replaceAll("_", " ")} · event {hold.source_event_id.slice(0, 12)}…</p></div><button type="button" onClick={() => startAppeal(hold)} className="shrink-0 rounded-full border border-border/70 px-3 py-1.5 text-[10px] font-bold text-foreground hover:bg-background">Appeal</button></div>)}
      {selected || sourceEventId ? <form onSubmit={submit} className="mt-3 space-y-2 rounded-xl border border-border/60 p-3">
        <div className="flex items-center justify-between"><p className="text-xs font-bold text-foreground">Submit reward appeal</p><button type="button" onClick={() => { setSelected(null); setSourceEventId("") }} aria-label="Close appeal form" className="rounded-full p-1 text-muted-foreground hover:bg-muted"><ChevronDown size={15} /></button></div>
        <label className="block text-[10px] font-semibold text-muted-foreground">Source event or ledger transaction ID<input required value={sourceEventId} onChange={(event) => setSourceEventId(event.target.value)} maxLength={256} className="mt-1 min-h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-xs text-foreground" /></label>
        <label className="block text-[10px] font-semibold text-muted-foreground">Reason<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-xs text-foreground"><option value="false_positive_hold">Hold appears incorrect</option><option value="missing_reward">Missing reward</option><option value="incorrect_amount">Incorrect amount</option><option value="settlement_delay">Settlement delay</option><option value="other">Other</option></select></label>
        <label className="block text-[10px] font-semibold text-muted-foreground">Explain the issue<textarea required minLength={20} maxLength={3000} rows={3} value={explanation} onChange={(event) => setExplanation(event.target.value)} className="mt-1 w-full rounded-lg border border-border/60 bg-background p-3 text-xs text-foreground" placeholder="Share the relevant event details…" /></label>
        <button type="submit" disabled={saving || !sourceEventId.trim() || explanation.trim().length < 20} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-50"><Scale size={14} aria-hidden="true" />{saving ? "Submitting…" : "Submit appeal"}</button>
      </form> : null}
      {message ? <p role="status" className="mt-2 text-[11px] text-muted-foreground">{message}</p> : null}
      {appeals.length ? <div className="mt-3 border-t border-border/50 pt-3"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Recent appeals</p>{appeals.slice(0, 3).map((appeal) => <div key={appeal.id} className="mt-2 flex items-center justify-between gap-2 text-xs"><span className="min-w-0 truncate text-muted-foreground">{appeal.category.replaceAll("_", " ")}</span><span className="shrink-0 rounded-full border border-border/60 px-2 py-1 text-[10px] font-semibold capitalize text-foreground">{appeal.status.replaceAll("_", " ")}</span></div>)}</div> : null}
    </section>
  )
}
