"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

type Survey = {
  id: string
  title: string
  description?: string
  questions: Array<{ id: string; prompt: string; maxLen?: number }>
}

type Session = {
  configured: boolean
  authenticated: boolean
  label: string | null
}

export function FieldDeskClient() {
  const [session, setSession] = useState<Session | null>(null)
  const [activeView, setActiveView] = useState<"overview" | "report" | "surveys">("overview")
  const [code, setCode] = useState("")
  const [label, setLabel] = useState("")
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)

  const [kind, setKind] = useState<"situation" | "result" | "general">("situation")
  const [body, setBody] = useState("")
  const [locationHint, setLocationHint] = useState("")
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [sendMessage, setSendMessage] = useState<string | null>(null)
  const [createdReportId, setCreatedReportId] = useState<string | null>(null)
  const [uploadingFieldEvidence, setUploadingFieldEvidence] = useState(false)
  const [fieldEvidenceNames, setFieldEvidenceNames] = useState<string[]>([])

  const [surveys, setSurveys] = useState<Survey[]>([])
  const [activeSurvey, setActiveSurvey] = useState<string | null>(null)
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string>>({})

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/field/session", { credentials: "include", cache: "no-store" })
      const data = await res.json()
      setSession({
        configured: Boolean(data.configured),
        authenticated: Boolean(data.authenticated),
        label: data.label || null,
      })
      return Boolean(data.authenticated)
    } catch {
      setSession({ configured: false, authenticated: false, label: null })
      return false
    }
  }, [])

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  useEffect(() => {
    if (!session?.authenticated) return
    void (async () => {
      try {
        const res = await fetch("/api/field/surveys", { credentials: "include", cache: "no-store" })
        const data = await res.json()
        if (data.ok && Array.isArray(data.surveys)) setSurveys(data.surveys)
      } catch {
        /* ignore */
      }
    })()
  }, [session?.authenticated])

  async function onUnlock(e: React.FormEvent) {
    e.preventDefault()
    setUnlocking(true)
    setUnlockError(null)
    try {
      const res = await fetch("/api/field/unlock", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, label: label || undefined }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setUnlockError(
          data.error === "INVALID_ACCESS_CODE"
            ? "That access code is not valid."
            : data.error === "FIELD_DESK_NOT_CONFIGURED"
              ? "Field Desk is not configured on this deployment yet."
              : "Could not unlock. Try again shortly.",
        )
        setUnlocking(false)
        return
      }
      setCode("")
      await refreshSession()
    } catch {
      setUnlockError("Network error. Check your connection and try again.")
    }
    setUnlocking(false)
  }

  async function onSendReport(e: React.FormEvent) {
    e.preventDefault()
    setSendState("sending")
    setSendMessage(null)
    try {
      const res = await fetch("/api/field/report", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, body, locationHint: locationHint || undefined }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setSendState("error")
        setSendMessage(
          data.error === "FIELD_AUTH_REQUIRED"
            ? "Session expired. Unlock again with your access code."
            : "Could not send report.",
        )
        return
      }
      setSendState("sent")
      setSendMessage(data.message || "Report received.")
      setCreatedReportId(data.evidenceUploadAvailable ? String(data.id || "") : null)
      setFieldEvidenceNames([])
      if (!data.evidenceUploadAvailable) setSendMessage("Report saved. Direct evidence upload becomes available after the scoped field-session migration is applied to this environment.")
      setBody("")
      setLocationHint("")
    } catch {
      setSendState("error")
      setSendMessage("Network error.")
    }
  }

  async function onSendSurvey(survey: Survey) {
    setSendState("sending")
    setSendMessage(null)
    const lines = survey.questions.map((q) => {
      const answer = (surveyAnswers[`${survey.id}:${q.id}`] || "").trim()
      return `${q.prompt}\n${answer || "(no answer)"}`
    })
    const composed = `Survey: ${survey.title}\n\n${lines.join("\n\n")}`
    try {
      const res = await fetch("/api/field/report", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "survey", body: composed, surveyId: survey.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setSendState("error")
        setSendMessage("Could not submit survey.")
        return
      }
      setSendState("sent")
      setSendMessage("Survey submitted to central desk.")
      setCreatedReportId(data.evidenceUploadAvailable ? String(data.id || "") : null)
      setFieldEvidenceNames([])
      if (!data.evidenceUploadAvailable) setSendMessage("Report saved. Direct evidence upload becomes available after the scoped field-session migration is applied to this environment.")
      setActiveSurvey(null)
      setSurveyAnswers({})
    } catch {
      setSendState("error")
      setSendMessage("Network error.")
    }
  }

  async function onUploadFieldEvidence(file: File) {
    if (!createdReportId) return
    setUploadingFieldEvidence(true)
    setSendMessage(null)
    try {
      const intentRes = await fetch(`/api/field/reports/${createdReportId}/evidence/intent`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mimeType: file.type, byteSize: file.size, fileName: file.name }) })
      const intent = await intentRes.json()
      if (!intentRes.ok || !intent.ok) throw new Error(intent.error || "Could not prepare secure upload.")
      const put = await fetch(intent.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type, "x-upsert": "false" }, body: file })
      if (!put.ok) throw new Error("Storage upload failed. Please retry.")
      const completeRes = await fetch(`/api/field/reports/${createdReportId}/evidence/complete`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uploadId: intent.uploadId, token: intent.token }) })
      const complete = await completeRes.json()
      if (!completeRes.ok || !complete.ok) throw new Error(complete.error || "Evidence verification failed.")
      setFieldEvidenceNames((rows) => [...rows, file.name])
      setSendMessage("Evidence uploaded into quarantine. Central review follows security scanning.")
    } catch (error) {
      setSendMessage(error instanceof Error ? error.message : "Evidence upload failed.")
    } finally { setUploadingFieldEvidence(false) }
  }

  async function onLock() {
    await fetch("/api/field/session", { method: "DELETE", credentials: "include" })
    setSession({ configured: session?.configured ?? true, authenticated: false, label: null })
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg bg-background px-5 pb-24 pt-[max(1.25rem,env(safe-area-inset-top))] text-foreground">
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]" aria-label="Public navigation">
        <Link href="/" className="font-bold text-emerald-600">
          ← GreenHaven
        </Link>
        <Link href="/field/studio" className="text-muted-foreground hover:text-foreground">
          Research Studio
        </Link>
        <Link href="/field/admin/evidence" className="text-muted-foreground hover:text-foreground">
          Evidence Review
        </Link>
        <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
          Privacy
        </Link>
        <Link href="/support" className="text-muted-foreground hover:text-foreground">
          Support
        </Link>
      </nav>

      <header className="relative mt-6 overflow-hidden rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 px-5 py-6 text-white shadow-lg shadow-emerald-950/10">
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-2 -top-8 h-32 w-32 rounded-full border border-white/10" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-50">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Research & intelligence
            </span>
            <span className="text-[10px] font-semibold text-emerald-100/80">PUBLIC PORTAL</span>
          </div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight">Field Research</h1>
          <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-emerald-50/85">
            Collect insights, field observations and survey responses in one trusted workspace — accessible from any browser.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold text-white/90">
            <span className="rounded-full bg-white/10 px-3 py-1.5">Surveys</span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">Field reports</span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">Election observation</span>
          </div>
        </div>
      </header>
      <div className="mt-4 grid grid-cols-3 gap-2" aria-label="Research capabilities">
        {[{ n: "01", t: "Create", d: "Build a study" }, { n: "02", t: "Share", d: "Invite anyone" }, { n: "03", t: "Analyse", d: "Review responses" }].map((item) => (
          <div key={item.n} className="rounded-2xl border border-border/70 bg-card px-3 py-3">
            <p className="text-[10px] font-bold tracking-widest text-emerald-700 dark:text-emerald-400">{item.n}</p>
            <p className="mt-1 text-[13px] font-bold">{item.t}</p>
            <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{item.d}</p>
          </div>
        ))}
      </div>

      {!session?.authenticated ? (
        <section className="mt-8 space-y-4" aria-labelledby="unlock-heading">
          <h2 id="unlock-heading" className="text-lg font-semibold">
            Unlock with access code
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Use one of the codes issued by GreenHaven operations. Codes are shared with field agents
            only and expire with this browser session.
          </p>
          {session && !session.configured && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-900 dark:text-amber-100">
              Field Desk is not configured on this server yet (access codes / session secret missing).
            </p>
          )}
          <form onSubmit={onUnlock} className="space-y-3">
            <label className="block text-[13px] font-medium">
              Access code
              <input
                type="password"
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[15px] outline-none ring-emerald-500/40 focus:ring-2"
                required
                inputMode="numeric"
                minLength={4}
                maxLength={128}
              />
            </label>
            <label className="block text-[13px] font-medium">
              Agent label (optional)
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Ward 4 team"
                className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[15px] outline-none ring-emerald-500/40 focus:ring-2"
                maxLength={40}
              />
            </label>
            {unlockError && (
              <p className="text-[13px] text-red-600 dark:text-red-400" role="alert">
                {unlockError}
              </p>
            )}
            <button
              type="submit"
              disabled={unlocking || code.length < 4}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {unlocking ? "Unlocking…" : "Unlock Field Desk"}
            </button>
          </form>
        </section>
      ) : (
        <section className="mt-8 space-y-8">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">Workspace active</p>
                <p className="mt-0.5 text-[13px] font-semibold">Field agent workspace</p>
              </div>
              <span className="rounded-full bg-emerald-600/10 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">Secure session</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1" aria-label="Workspace navigation">
              {([ ["overview", "Overview"], ["report", "Report"], ["surveys", "Surveys"] ] as const).map(([id, title]) => (
                <button key={id} type="button" onClick={() => setActiveView(id)} className={`min-h-9 rounded-lg px-2 text-[11px] font-bold transition ${activeView === id ? "bg-card text-emerald-700 shadow-sm dark:text-emerald-300" : "text-muted-foreground hover:text-foreground"}`}>{title}</button>
              ))}
            </div>
          </div>
          {activeView === "overview" ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-border/70 bg-card p-4">
                <p className="text-sm font-bold">Your field workspace</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">Choose a task to continue. Submitted reports are sent to the configured central desk.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setActiveView("report")} className="rounded-xl bg-emerald-700 px-3 py-3 text-left text-white"><span className="block text-[13px] font-bold">New report</span><span className="mt-1 block text-[10px] text-emerald-50/80">Submit an observation</span></button>
                  <button type="button" onClick={() => setActiveView("surveys")} className="rounded-xl border border-border bg-muted/40 px-3 py-3 text-left"><span className="block text-[13px] font-bold">Open surveys</span><span className="mt-1 block text-[10px] text-muted-foreground">Answer assigned studies</span></button>
                </div>
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-muted-foreground">
              Signed in as field agent
              {session.label ? (
                <>
                  : <span className="font-medium text-foreground">{session.label}</span>
                </>
              ) : null}
            </p>
            <button
              type="button"
              onClick={() => void onLock()}
              className="text-[13px] font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
            >
              Lock
            </button>
          </div>

          {activeView === "report" ? <form onSubmit={onSendReport} className="space-y-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Submit field report</h2>
            <p className="text-[12px] text-muted-foreground">
              Text only. Delivered to the central GreenHaven desk in real time. Do not include passwords,
              bank details, or other people&apos;s personal data.
            </p>
            <label className="block text-[13px] font-medium">
              Type
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[15px]"
              >
                <option value="situation">Situation report</option>
                <option value="result">Result / tally note</option>
                <option value="general">General</option>
              </select>
            </label>
            <label className="block text-[13px] font-medium">
              Area (optional)
              <input
                type="text"
                value={locationHint}
                onChange={(e) => setLocationHint(e.target.value)}
                placeholder="Ward, LGA, or polling unit code"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[15px]"
                maxLength={80}
              />
            </label>
            <label className="block text-[13px] font-medium">
              Message
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                rows={5}
                maxLength={4000}
                className="mt-1 w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-[15px] leading-relaxed"
                placeholder="Facts only — what you observe right now"
              />
            </label>
            <button
              type="submit"
              disabled={sendState === "sending" || body.trim().length < 1}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {sendState === "sending" ? "Sending…" : "Send to central desk"}
            </button>
            {sendMessage && (
              <p
                className={`text-[13px] ${sendState === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}
                role="status"
              >
                {sendMessage}
              </p>
            )}
          </form> : null}

          {(activeView === "report" || activeView === "surveys") && createdReportId ? <section className="mt-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4"><h3 className="text-sm font-bold">Attach supporting evidence</h3><p className="mt-1 text-xs text-muted-foreground">Upload photos, video, audio or PDF for this report. Files are private and quarantined pending security scanning.</p><label className="mt-3 inline-flex cursor-pointer rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white">{uploadingFieldEvidence ? "Uploading…" : "Add evidence file"}<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,audio/webm,audio/flac,application/pdf" disabled={uploadingFieldEvidence} onChange={e=>{const f=e.target.files?.[0];if(f)void onUploadFieldEvidence(f);e.currentTarget.value=""}}/></label>{fieldEvidenceNames.length>0&&<ul className="mt-3 space-y-1 text-xs">{fieldEvidenceNames.map((name,i)=><li key={`${name}-${i}`}>✓ {name} · quarantined</li>)}</ul>}</section> : null}

          {activeView === "surveys" && surveys.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Available research</h2>
              <ul className="space-y-2">
                {surveys.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setActiveSurvey(activeSurvey === s.id ? null : s.id)}
                      className="flex w-full items-start justify-between rounded-xl border border-border/60 bg-card px-4 py-3 text-left"
                    >
                      <span>
                        <span className="block font-medium">{s.title}</span>
                        {s.description ? (
                          <span className="mt-0.5 block text-[12px] text-muted-foreground">{s.description}</span>
                        ) : null}
                      </span>
                      <span className="text-[12px] text-emerald-700 dark:text-emerald-400">
                        {activeSurvey === s.id ? "Close" : "Open"}
                      </span>
                    </button>
                    {activeSurvey === s.id && (
                      <div className="mt-2 space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                        {s.questions.map((q) => (
                          <label key={q.id} className="block text-[13px] font-medium">
                            {q.prompt}
                            <textarea
                              rows={2}
                              maxLength={q.maxLen || 400}
                              value={surveyAnswers[`${s.id}:${q.id}`] || ""}
                              onChange={(e) =>
                                setSurveyAnswers((prev) => ({
                                  ...prev,
                                  [`${s.id}:${q.id}`]: e.target.value,
                                }))
                              }
                              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[14px]"
                            />
                          </label>
                        ))}
                        <button
                          type="button"
                          onClick={() => void onSendSurvey(s)}
                          className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-[14px] font-semibold text-white"
                        >
                          Submit survey
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {activeView === "surveys" && surveys.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center">
              <p className="text-sm font-semibold">No surveys assigned</p>
              <p className="mt-1 text-xs text-muted-foreground">When a research owner publishes a survey for this field workspace, it will appear here.</p>
            </div>
          ) : null}
        </section>
      )}

      <footer className="mt-12 text-[11px] leading-relaxed text-muted-foreground">
        Field Research access codes do not grant GreenHaven account login, π payments, or admin privileges.
        Field submissions support text reports, surveys and scoped evidence uploads. Uploaded evidence remains quarantined until security scanning and review are complete. For app support use{" "}
        <Link href="/support" className="underline-offset-2 hover:underline">
          Support
        </Link>
        .
      </footer>
    </main>
  )
}
