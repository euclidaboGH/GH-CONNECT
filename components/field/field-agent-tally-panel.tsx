"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"

type Candidate = { id: string; name: string; party: string; ballotOrder: number | null }
type AssignmentItem = {
  key: string
  assignmentId: string
  projectId: string
  projectTitle: string
  contestId: string
  contestTitle: string
  countryCode: string
  electionDate: string | null
  assignmentRole: string
  assignmentStatus: string
  geoUnit: { id: string; name: string; pollingUnitCode: string | null; sourceRef: string | null; sourceVersion: string | null } | null
  candidates: Candidate[]
  canSubmit: boolean
  canAccept: boolean
  blockers: string[]
}
type AssignedResponse = { ok?: boolean; error?: string; items?: AssignmentItem[] }
const integerOrNull = (value: string) => value.trim() === "" ? null : Number(value)
const isCount = (value: number | null) => value === null || (Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000)

export function FieldAgentTallyPanel() {
  const [items, setItems] = useState<AssignmentItem[]>([])
  const [selectedKey, setSelectedKey] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [registered, setRegistered] = useState("")
  const [accredited, setAccredited] = useState("")
  const [totalBallots, setTotalBallots] = useState("")
  const [validVotes, setValidVotes] = useState("")
  const [rejectedBallots, setRejectedBallots] = useState("")
  const [candidateVotes, setCandidateVotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/research/elections/assigned", { credentials: "include", cache: "no-store" })
      const data = await response.json() as AssignedResponse
      if (!response.ok || !data.ok) {
        if (response.status === 401) throw new Error("Sign in to GreenHaven to view your assigned election work.")
        throw new Error("Tally assignments are unavailable until the reviewed Research Intelligence database migrations and verified polling-unit dataset are ready.")
      }
      const rows = Array.isArray(data.items) ? data.items : []
      setItems(rows)
      setSelectedKey((current) => rows.some((item) => item.key === current) ? current : rows[0]?.key || "")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load assigned tally work.")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  const selected = items.find((item) => item.key === selectedKey) || null
  const candidateTotal = useMemo(() => Object.values<string>(candidateVotes).reduce((sum, value) => sum + (value.trim() ? Number(value) : 0), 0), [candidateVotes])

  useEffect(() => {
    setCandidateVotes(Object.fromEntries((selected?.candidates || []).map((candidate) => [candidate.id, ""])))
    setRegistered("")
    setAccredited("")
    setTotalBallots("")
    setValidVotes("")
    setRejectedBallots("")
    setNotice("")
  }, [selectedKey, selected?.candidates])

  async function acceptAssignment() {
    if (!selected?.canAccept) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch(`/api/research/elections/assignments/${selected.assignmentId}`, { method: "PATCH", credentials: "include", cache: "no-store" })
      const data = await response.json() as { ok?: boolean; error?: string; idempotent?: boolean }
      if (!response.ok || !data.ok) throw new Error(data.error === "ASSIGNMENT_OUTSIDE_ACTIVE_WINDOW" ? "This assignment is outside its active time window." : "The assignment could not be accepted. Refresh and contact the project owner if it remains unavailable.")
      setNotice(data.idempotent ? "Your assignment is already accepted." : "Assignment accepted. Refreshing the secure tally desk…")
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not accept assignment.")
    } finally {
      setBusy(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected?.canSubmit || !selected.geoUnit?.pollingUnitCode) return
    setBusy(true)
    setError("")
    setNotice("")
    const registeredValue = integerOrNull(registered)
    const accreditedValue = integerOrNull(accredited)
    const totalValue = integerOrNull(totalBallots)
    const validValue = integerOrNull(validVotes)
    const rejectedValue = integerOrNull(rejectedBallots)
    const votes = selected.candidates.map((candidate) => ({ candidateId: candidate.id, votes: Number(candidateVotes[candidate.id]) }))
    const allCandidateCountsEntered = selected.candidates.every((candidate) => candidateVotes[candidate.id]?.trim() !== "")
    if (!isCount(registeredValue) || !isCount(accreditedValue) || !isCount(totalValue) || !isCount(validValue) || validValue === null || !isCount(rejectedValue) || rejectedValue === null || !allCandidateCountsEntered || votes.some((item) => !isCount(item.votes)) || votes.reduce((sum, item) => sum + item.votes, 0) !== validValue) {
      setError("Enter valid non-negative whole-number counts. Candidate votes must add up exactly to valid votes.")
      setBusy(false)
      return
    }
    if (registeredValue !== null && accreditedValue !== null && accreditedValue > registeredValue) {
      setError("Accredited voters cannot exceed registered voters.")
      setBusy(false)
      return
    }
    if (totalValue !== null && (validValue + rejectedValue !== totalValue || (accreditedValue !== null && totalValue > accreditedValue))) {
      setError("Valid plus rejected ballots must equal total ballots, and total ballots cannot exceed accredited voters.")
      setBusy(false)
      return
    }
    try {
      const response = await fetch(`/api/research/projects/${selected.projectId}/elections/${selected.contestId}/tallies`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geoUnitId: selected.geoUnit.id,
          pollingUnitCode: selected.geoUnit.pollingUnitCode,
          registeredVoters: registeredValue,
          accreditedVoters: accreditedValue,
          totalBallots: totalValue,
          validVotes: validValue,
          rejectedBallots: rejectedValue,
          candidateVotes: votes,
        }),
      })
      const data = await response.json() as { ok?: boolean; error?: string; idempotent?: boolean; reconciliationStatus?: string }
      if (!response.ok || !data.ok) throw new Error(data.error === "AGENT_NOT_ASSIGNED" ? "Your assignment is no longer active. Refresh the desk or contact the project owner." : data.error === "CONTEST_NOT_ACTIVE" ? "This contest is no longer active." : "The server could not safely record this tally. No local result was treated as saved.")
      setNotice(data.idempotent ? "This exact submission was already recorded. No duplicate tally was created." : `Tally submitted for independent comparison. Current status: ${data.reconciliationStatus || "pending"}. This is not a certified result.`)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tally submission failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5" aria-labelledby="field-agent-tally-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-700 dark:text-emerald-400">Assigned field work</p>
          <h2 id="field-agent-tally-title" className="mt-1 text-lg font-black">Field-agent tally desk</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Submit only for an assigned, provenance-backed polling unit. Every submission remains pending independent comparison; this tool never certifies election results.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading || busy} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50">Refresh</button>
      </div>
      {loading ? <p className="mt-4 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">Checking your active assignments…</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-5 text-amber-800 dark:text-amber-200">{error}</p> : null}
      {!loading && !error && items.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No active election tally assignments were found for this account.</p> : null}
      {!loading && items.length > 0 ? <div className="mt-4 space-y-4">
        <label className="block text-xs font-bold">Assigned contest<select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm">{items.map((item) => <option key={item.key} value={item.key}>{item.projectTitle} · {item.contestTitle} · {item.geoUnit?.name || "Unscoped unit"}</option>)}</select></label>
        {selected ? <div className="rounded-xl bg-muted/40 p-3">
          <p className="text-sm font-bold">{selected.contestTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{selected.projectTitle} · {selected.countryCode} · {selected.electionDate || "Date not set"}</p>
          {selected.geoUnit ? <><p className="mt-2 text-xs font-semibold">{selected.geoUnit.name} · {selected.geoUnit.pollingUnitCode || "No external code"}</p><p className="mt-1 break-all text-[10px] text-muted-foreground">Dataset: {selected.geoUnit.sourceRef || "Unverified source"} · Version: {selected.geoUnit.sourceVersion || "Unknown"}</p></> : null}
          {!selected.canSubmit ? <div className="mt-3 space-y-1 text-xs text-amber-700 dark:text-amber-300">{selected.blockers.map((blocker) => <p key={blocker}>• {blocker}</p>)}</div> : null}
          {selected.canAccept ? <button type="button" onClick={() => void acceptAssignment()} disabled={busy} className="mt-3 rounded-lg border border-emerald-600/30 px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50">{busy ? "Accepting…" : "Accept field assignment"}</button> : null}
        </div> : null}
        {selected?.canSubmit ? <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold">Registered voters<input inputMode="numeric" type="number" min={0} max={1_000_000_000} step={1} value={registered} onChange={(event) => setRegistered(event.target.value)} className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Optional"/></label>
            <label className="text-xs font-semibold">Accredited voters<input inputMode="numeric" type="number" min={0} max={1_000_000_000} step={1} value={accredited} onChange={(event) => setAccredited(event.target.value)} className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Optional"/></label>
            <label className="text-xs font-semibold">Total ballots<input inputMode="numeric" type="number" min={0} max={1_000_000_000} step={1} value={totalBallots} onChange={(event) => setTotalBallots(event.target.value)} className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Optional"/></label>
            <label className="text-xs font-semibold">Valid votes<input required inputMode="numeric" type="number" min={0} max={1_000_000_000} step={1} value={validVotes} onChange={(event) => setValidVotes(event.target.value)} className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"/></label>
            <label className="text-xs font-semibold">Rejected ballots<input required inputMode="numeric" type="number" min={0} max={1_000_000_000} step={1} value={rejectedBallots} onChange={(event) => setRejectedBallots(event.target.value)} className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"/></label>
            <div className="rounded-lg bg-emerald-600/5 p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Candidate total</p><p className="mt-1 text-lg font-black tabular-nums">{candidateTotal.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Must equal valid votes</p></div>
          </div>
          <div><h3 className="text-sm font-bold">Candidate votes</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">{selected.candidates.map((candidate) => <label key={candidate.id} className="rounded-lg border border-border p-3 text-xs font-semibold">{candidate.ballotOrder ? `${candidate.ballotOrder}. ` : ""}{candidate.name}<span className="ml-1 font-normal text-muted-foreground">{candidate.party || "Independent"}</span><input required inputMode="numeric" type="number" min={0} max={1_000_000_000} step={1} value={candidateVotes[candidate.id] || ""} onChange={(event) => setCandidateVotes((current) => ({ ...current, [candidate.id]: event.target.value }))} className="mt-2 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"/></label>)}</div></div>
          <button type="submit" disabled={busy || !selected.canSubmit || selected.candidates.length === 0} className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Submitting securely…" : "Submit for independent comparison"}</button>
        </form> : null}
        {notice ? <p role="status" className="rounded-xl border border-emerald-600/25 bg-emerald-600/5 p-3 text-xs leading-5 text-emerald-800 dark:text-emerald-200">{notice}</p> : null}
      </div> : null}
      <p className="mt-4 border-t border-border pt-3 text-[10px] leading-5 text-muted-foreground">Your identity is derived from your GreenHaven session. Polling-unit codes and provenance come from the approved server dataset. The server checks your active assignment, contest state, candidate IDs and count consistency. Repeated identical submissions return the original record.</p>
    </section>
  )
}
