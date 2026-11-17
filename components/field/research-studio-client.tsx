"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { isResearchQuestionVisible } from "@/lib/research/logic"
import { uploadDurableMedia, mediaUploadErrorMessage } from "@/lib/media/upload-client"
import { IdentityService } from "@/lib/identity/identity-service"
import { promptDialog } from "@/lib/ui/global-interactions"

type QType = "short_text" | "long_text" | "single_choice" | "multiple_choice" | "dropdown" | "rating" | "number" | "date"
type Question = { id: string; type: QType; label: string; required: boolean; options?: string[]; showWhen?: { questionId: string; operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "answered" | "not_answered"; value?: string | number } }
type Project = { id: string; slug: string; title: string; description?: string; project_type: string; status: string; form_schema?: { questions?: Question[] }; created_at?: string }
type ResponseRow = { id: string; answers: Record<string, string | string[] | number>; review_status: string; submitted_at: string }
type EvidenceRow = { id: string; response_id: string | null; media_kind: string; mime_type: string; caption: string; verification_status: string; scan_status?: string; sha256?: string; created_at: string }
const TYPES: Array<{ id: string; title: string; description: string }> = [
  { id: "survey", title: "Survey", description: "Collect opinions, experiences and feedback." },
  { id: "examination", title: "Examination", description: "Create structured tests and assessments." },
  { id: "election_observation", title: "Election observation", description: "Capture polling-unit observations and tally reports." },
  { id: "registration", title: "Registration", description: "Collect applications and participant details." },
  { id: "custom", title: "Custom form", description: "Build a form for any other workflow." },
]
const Q_TYPES: Array<{ id: QType; title: string }> = [
  { id: "short_text", title: "Short answer" }, { id: "long_text", title: "Paragraph" }, { id: "single_choice", title: "Multiple choice (one)" }, { id: "multiple_choice", title: "Checkboxes" }, { id: "dropdown", title: "Dropdown" }, { id: "rating", title: "Rating" }, { id: "number", title: "Number" }, { id: "date", title: "Date" },
]
const makeId = () => `q_${Math.random().toString(36).slice(2, 11)}`
function starterQuestions(type: string): Question[] {
  const rows: Array<[QType, string, boolean, string[]?]> = type === "election_observation" ? [
    ["short_text", "Country", true], ["short_text", "State / Province", true], ["short_text", "Senatorial District / Zone", true],
    ["short_text", "LGA / County", true], ["short_text", "Ward", true], ["short_text", "Polling Unit name or code", true],
    ["short_text", "Election / Contest", true], ["short_text", "Position / Office", true], ["short_text", "Candidate name", true],
    ["short_text", "Party / Affiliation", false], ["number", "Votes recorded for this candidate", true],
    ["number", "Total valid votes", false], ["number", "Rejected / invalid ballots", false], ["long_text", "Incidents, observations and additional details", false],
  ] : type === "examination" ? [
    ["short_text", "Candidate / learner reference", true], ["short_text", "Subject / course", true],
    ["long_text", "Question 1 — enter your answer", true], ["long_text", "Question 2 — enter your answer", false],
  ] : type === "registration" ? [
    ["short_text", "Participant or organisation name", true], ["short_text", "Country and area", true],
    ["short_text", "Registration reference (if available)", false], ["long_text", "Purpose of registration or additional details", false],
  ] : type === "survey" ? [
    ["short_text", "Which area or community are you responding from?", false],
    ["single_choice", "How would you rate your current experience?", true, ["Very good", "Good", "Fair", "Poor"]],
    ["long_text", "What should be improved?", false],
  ] : [["long_text", "Tell us what you would like to share", true]]
  return rows.map(([qType, label, required, options]) => ({ id: makeId(), type: qType, label, required, ...(options ? { options } : {}) }))
}

export function ResearchStudioClient() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [step, setStep] = useState<"home" | "type" | "builder" | "preview" | "inbox">("home")
  const [projectType, setProjectType] = useState("survey")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [questions, setQuestions] = useState<Question[]>([{ id: makeId(), type: "short_text", label: "Your question", required: true }])
  const [saving, setSaving] = useState(false)
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [responses, setResponses] = useState<ResponseRow[]>([])
  const [evidence, setEvidence] = useState<EvidenceRow[]>([])
  const [uploadingEvidence, setUploadingEvidence] = useState<string | null>(null)
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string | string[]>>({})
  const [notice, setNotice] = useState("")

  async function loadProjects() {
    setLoading(true)
    try {
      const r = await fetch("/api/research/projects", { credentials: "include", cache: "no-store" })
      const d = await r.json()
      if (!r.ok || !d.ok) throw new Error(d.error === "AUTH_REQUIRED" ? "Sign in to GreenHaven to create and manage research." : "Research workspace is temporarily unavailable.")
      setProjects(Array.isArray(d.projects) ? d.projects : [])
      setError("")
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load research.") }
    setLoading(false)
  }
  useEffect(() => { void loadProjects() }, [])

  const publicUrl = useMemo(() => activeProject && typeof window !== "undefined" ? `${window.location.origin}/r/${activeProject.slug}` : "", [activeProject])
  const previewQuestions = useMemo(() => { const source = activeProject?.form_schema?.questions || questions; const visible: Question[] = []; const values: Record<string, unknown> = {}; for (const q of source) { if (isResearchQuestionVisible(q.showWhen, values)) { visible.push(q); if (previewAnswers[q.id] !== undefined) values[q.id] = previewAnswers[q.id] } } return visible }, [activeProject, questions, previewAnswers])

  function addQuestion() { setQuestions((p) => [...p, { id: makeId(), type: "short_text", label: "New question", required: false }]) }
  function updateQuestion(id: string, patch: Partial<Question>) { setQuestions((p) => p.map((q) => q.id === id ? { ...q, ...patch } : q)) }
  function removeQuestion(id: string) { setQuestions((p) => p.length > 1 ? p.filter((q) => q.id !== id) : p) }

  async function createProject() {
    setSaving(true); setError(""); setNotice("")
    try {
      const r = await fetch("/api/research/projects", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description, projectType, questions }) })
      const d = await r.json()
      if (!r.ok || !d.ok) throw new Error(d.error === "AUTH_REQUIRED" ? "Please sign in first." : "Could not save this research. Check your questions and try again.")
      const project = d.project as Project
      setProjects((p) => [project, ...p]); setActiveProject(project); setStep("preview"); setNotice("Draft saved. Preview it, then publish when ready.")
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed.") }
    setSaving(false)
  }

  async function changeStatus(project: Project, status: string) {
    setSaving(true); setError("")
    try {
      const r = await fetch(`/api/research/projects/${project.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
      const d = await r.json()
      if (!r.ok || !d.ok) throw new Error("Could not update publication status.")
      const updated = { ...project, ...d.project } as Project
      setProjects((p) => p.map((x) => x.id === project.id ? updated : x)); setActiveProject(updated)
      setNotice(status === "published" ? "Your form is now live. Copy and share its public link." : `Research ${status}.`)
    } catch (e) { setError(e instanceof Error ? e.message : "Update failed.") }
    setSaving(false)
  }

  async function openInbox(project: Project) {
    setActiveProject(project); setStep("inbox"); setResponses([]); setEvidence([]); setError("")
    const r = await fetch(`/api/research/projects/${project.id}/responses`, { credentials: "include", cache: "no-store" })
    const d = await r.json()
    if (!r.ok || !d.ok) { setError("Could not load responses."); return }
    setResponses(Array.isArray(d.responses) ? d.responses : [])
    const er = await fetch(`/api/research/projects/${project.id}/evidence`, { credentials: "include", cache: "no-store" })
    const ed = await er.json().catch(() => ({}))
    if (er.ok && ed.ok && Array.isArray(ed.evidence)) setEvidence(ed.evidence)
  }

  async function attachEvidence(responseId: string, file?: File) {
    if (!activeProject || !file) return
    setUploadingEvidence(responseId); setError("")
    try {
      const mime = file.type.toLowerCase()
      const category = mime.startsWith("image/") ? "images" : mime.startsWith("video/") ? "videos" : mime.startsWith("audio/") ? "audio" : "documents"
      const uploaded = await uploadDurableMedia(file, { category, fileName: file.name, expectedUserId: IdentityService.getCurrentUserId() })
      if (!uploaded.ok) throw new Error(mediaUploadErrorMessage(uploaded, "Evidence upload failed."))
      const r = await fetch(`/api/research/projects/${activeProject.id}/evidence`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaId: uploaded.mediaId, responseId }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) throw new Error(d.error === "EVIDENCE_ALREADY_ATTACHED" ? "This file is already attached." : "The upload succeeded but could not be attached to this response.")
      setEvidence((rows) => [d.evidence, ...rows])
      setNotice("Evidence uploaded and attached. It is private and awaiting review.")
    } catch (e) { setError(e instanceof Error ? e.message : "Evidence upload failed.") }
    setUploadingEvidence(null)
  }

  async function reviewEvidence(evidenceId: string, status: "verified" | "rejected" | "quarantined") {
    if (!activeProject) return
    const r = await fetch(`/api/research/projects/${activeProject.id}/evidence`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ evidenceId, status }) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok || !d.ok) { setError("Could not update evidence review status."); return }
    setEvidence((rows) => rows.map((row) => row.id === evidenceId ? { ...row, verification_status: status } : row))
  }

  async function showCopyLinkDialog(link: string, message: string) {
    await promptDialog({
      title: "Copy public research link",
      message,
      label: "Research link",
      defaultValue: link,
      confirmLabel: "Done",
      cancelLabel: "Close",
      maxLength: 2048,
    })
  }

  async function copyLink(project: Project) {
    const link = `${window.location.origin}/r/${project.slug}`
    try {
      if (!navigator.clipboard?.writeText) throw new Error("CLIPBOARD_UNAVAILABLE")
      await navigator.clipboard.writeText(link)
      setNotice("Public link copied. Anyone with the link can respond in a browser.")
    } catch {
      await showCopyLinkDialog(link, "Clipboard access is unavailable. Select and copy the link below.")
    }
  }

  async function shareLink(project: Project, channel: "native" | "whatsapp" | "facebook" | "greenhaven") {
    const link = `${window.location.origin}/r/${project.slug}`
    const text = `Please participate in this GreenHaven research: ${project.title}`
    if (channel === "native") {
      if (navigator.share) { try { await navigator.share({ title: project.title, text, url: link }); return } catch { return } }
      try { if (!navigator.clipboard?.writeText) throw new Error("CLIPBOARD_UNAVAILABLE"); await navigator.clipboard.writeText(link); setNotice("Public link copied. Share it with any app or platform.") } catch { await showCopyLinkDialog(link, "Clipboard access is unavailable. Select and copy the link below.") }
      return
    }
    if (channel === "whatsapp") { window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`, "_blank", "noopener,noreferrer"); return }
    if (channel === "facebook") { window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, "_blank", "noopener,noreferrer"); return }
    try { if (!navigator.clipboard?.writeText) throw new Error("CLIPBOARD_UNAVAILABLE"); await navigator.clipboard.writeText(link) } catch { await showCopyLinkDialog(link, "Copy the research link below, then paste it into GreenHaven Messages.") }
    window.open("/?tab=messages", "_blank", "noopener,noreferrer")
    setNotice("Research link ready. GreenHaven Messages opened in a new tab; paste the link into your conversation.")
  }

  return <main className="mx-auto min-h-dvh w-full max-w-6xl px-4 pb-24 pt-6 text-foreground sm:px-6 lg:px-8">
    <nav className="flex items-center justify-between gap-3" aria-label="Research navigation">
      <Link href="/" className="text-sm font-bold text-emerald-700 dark:text-emerald-400">← GreenHaven</Link>
      <div className="flex gap-2 text-xs"><Link href="/field" className="rounded-full border border-border px-3 py-2">Field agent portal</Link><span className="rounded-full bg-emerald-600/10 px-3 py-2 font-semibold text-emerald-700 dark:text-emerald-300">Research Studio</span></div>
    </nav>
    <header className="relative mt-6 overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-6 text-white shadow-xl sm:p-9">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/10"/><div className="pointer-events-none absolute -right-4 -top-12 h-48 w-48 rounded-full border border-white/10"/>
      <div className="relative max-w-3xl"><p className="text-[11px] font-bold uppercase tracking-[.22em] text-emerald-200">Research & intelligence ecosystem</p><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Turn questions into insight.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/85">Create professional surveys, examinations, field studies and observation forms. Publish a link, collect responses from any browser and manage everything in one workspace.</p><div className="mt-6 flex flex-wrap gap-2"><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs">No JSON configuration</span><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs">Public browser responses</span><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs">Owner response inbox</span></div></div>
    </header>
    {notice && <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">{notice}<button onClick={() => setNotice("")} className="font-semibold underline">Dismiss</button></div>}
    {error && <div role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

    {step === "home" && <section className="mt-7 space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">{[{n:"01",t:"Create",d:"Choose a template and build with simple question controls."},{n:"02",t:"Publish",d:"Preview your form and generate a unique share link."},{n:"03",t:"Understand",d:"Receive responses and review them in your private inbox."}].map(x=><div key={x.n} className="rounded-2xl border border-border bg-card p-4"><p className="text-xs font-bold tracking-widest text-emerald-700 dark:text-emerald-400">{x.n}</p><h2 className="mt-2 font-bold">{x.t}</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">{x.d}</p></div>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Your research</h2><p className="mt-1 text-sm text-muted-foreground">Manage drafts, published forms and incoming responses.</p></div><button onClick={()=>{setTitle("");setDescription("");setProjectType("survey");setQuestions([{id:makeId(),type:"short_text",label:"Your question",required:true}]);setStep("type")}} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/10 hover:bg-emerald-800">＋ Create research</button></div>
      {loading ? <div className="rounded-2xl border border-border p-8 text-center text-sm text-muted-foreground">Loading your workspace…</div> : projects.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600/10 text-2xl">✦</div><h3 className="mt-4 text-lg font-bold">Your research workspace starts here</h3><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Create your first survey, examination or field research form. You can preview it before publishing.</p><button onClick={()=>setStep("type")} className="mt-5 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white">Create your first form</button></div> : <div className="grid gap-3 md:grid-cols-2">{projects.map(p=><article key={p.id} className="rounded-2xl border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{p.project_type.replaceAll("_"," ")}</p><h3 className="mt-1 font-bold">{p.title}</h3><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description || "No description added."}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${p.status === "published" ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{p.status}</span></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={()=>{setActiveProject(p);setStep("preview")}} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Open</button><button onClick={()=>void openInbox(p)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Responses</button>{p.status === "published" ? <button onClick={()=>void copyLink(p)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">Copy link</button> : <button onClick={()=>void changeStatus(p,"published")} disabled={saving} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">Publish</button>}</div></article>)}</div>}
    </section>}

    {step === "type" && <section className="mx-auto mt-8 max-w-4xl"><button onClick={()=>setStep("home")} className="text-sm font-semibold text-emerald-700">← Back to workspace</button><h2 className="mt-4 text-2xl font-black">What are you creating?</h2><p className="mt-1 text-sm text-muted-foreground">Start with a purpose. You can customize every question next.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{TYPES.map(t=><button key={t.id} onClick={()=>{setProjectType(t.id);setStep("builder");setTitle(t.title);setDescription(t.id==="election_observation"?"Structured field observation. Submissions are reports for review, not official certified election results.":t.id==="examination"?"Assessment form template. Timed delivery and automatic scoring are not enabled in this release.":t.description);setQuestions(starterQuestions(t.id))}} className={`rounded-2xl border p-5 text-left transition hover:border-emerald-500 hover:bg-emerald-500/5 ${projectType===t.id?"border-emerald-500 bg-emerald-500/5":"border-border bg-card"}`}><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-lg text-emerald-700">{t.id==="survey"?"◉":t.id==="examination"?"▤":t.id==="election_observation"?"⌖":t.id==="registration"?"＋":"✧"}</span><h3 className="mt-3 font-bold">{t.title}</h3><p className="mt-1 text-sm text-muted-foreground">{t.description}</p></button>)}</div></section>}

    {step === "builder" && <section className="mx-auto mt-8 max-w-4xl space-y-5"><div className="flex items-center justify-between"><button onClick={()=>setStep("type")} className="text-sm font-semibold text-emerald-700">← Change type</button><span className="text-xs text-muted-foreground">Step 2 of 3 · Form builder</span></div><div className="rounded-2xl border border-border bg-card p-5"><label className="block text-sm font-semibold">Form title<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={140} placeholder="e.g. Community health survey" className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-base"/></label><label className="mt-4 block text-sm font-semibold">Description<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={1200} rows={3} placeholder="Explain the purpose and who should respond…" className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm"/></label></div><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Questions</h2><p className="text-xs text-muted-foreground">Add, edit and mark questions as required.</p></div><button onClick={addQuestion} className="rounded-xl border border-emerald-600/30 px-4 py-2.5 text-sm font-bold text-emerald-700 dark:text-emerald-300">＋ Add question</button></div>{questions.map((q,i)=><div key={q.id} className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold text-muted-foreground">QUESTION {i+1}</span><button onClick={()=>removeQuestion(q.id)} className="text-xs font-semibold text-red-600">Remove</button></div><input value={q.label} onChange={e=>updateQuestion(q.id,{label:e.target.value})} maxLength={240} className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm font-medium" aria-label={`Question ${i+1} label`}/><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-muted-foreground">Answer type<select value={q.type} onChange={e=>updateQuestion(q.id,{type:e.target.value as QType,options:["single_choice","multiple_choice","dropdown"].includes(e.target.value)?(q.options?.length?q.options:["Option 1","Option 2"]):undefined})} className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground">{Q_TYPES.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label><label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={q.required} onChange={e=>updateQuestion(q.id,{required:e.target.checked})}/> Required question</label></div>{q.options && <label className="mt-3 block text-xs font-semibold text-muted-foreground">Options · one per line<textarea value={q.options.join("\n")} onChange={e=>updateQuestion(q.id,{options:e.target.value.split("\n").map(s=>s.trim()).filter(Boolean).slice(0,30)})} rows={3} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground"/></label>}<div className="mt-3 rounded-xl border border-dashed border-border p-3"><p className="text-xs font-bold">Conditional display</p><p className="mt-1 text-[11px] text-muted-foreground">Optionally show this question based on an earlier answer.</p><select aria-label={`Condition source for question ${i+1}`} value={q.showWhen?.questionId||""} onChange={e=>updateQuestion(q.id,{showWhen:e.target.value?{questionId:e.target.value,operator:"equals",value:""}:undefined})} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"><option value="">Always show</option>{questions.slice(0,i).map(prev=><option key={prev.id} value={prev.id}>{prev.label}</option>)}</select>{q.showWhen&&<div className="mt-2 grid grid-cols-2 gap-2"><select aria-label="Condition operator" value={q.showWhen.operator} onChange={e=>updateQuestion(q.id,{showWhen:{...q.showWhen!,operator:e.target.value as NonNullable<Question["showWhen"]>["operator"]}})} className="rounded-lg border border-border bg-background px-2 py-2 text-xs"><option value="equals">Equals</option><option value="not_equals">Does not equal</option><option value="contains">Contains</option><option value="greater_than">Greater than</option><option value="less_than">Less than</option><option value="answered">Has an answer</option><option value="not_answered">No answer</option></select>{!["answered","not_answered"].includes(q.showWhen.operator)&&<input aria-label="Condition value" value={String(q.showWhen.value??"")} onChange={e=>updateQuestion(q.id,{showWhen:{...q.showWhen!,value:e.target.value}})} placeholder="Matching answer" className="min-w-0 rounded-lg border border-border bg-background px-2 py-2 text-xs"/>}</div>}</div></div>)}<div className="flex flex-wrap justify-end gap-2"><button onClick={()=>setStep("preview")} className="rounded-xl border border-border px-5 py-3 text-sm font-bold">Preview</button><button disabled={saving||!title.trim()||questions.some(q=>!q.label.trim())} onClick={()=>void createProject()} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving?"Saving…":"Save draft and preview"}</button></div></section>}

    {step === "preview" && <section className="mx-auto mt-8 max-w-3xl space-y-4"><button onClick={()=>setStep(activeProject?"home":"builder")} className="text-sm font-semibold text-emerald-700">← {activeProject?"Back to workspace":"Back to editor"}</button><div className="rounded-2xl border border-border bg-card p-6"><p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">{activeProject?.project_type.replaceAll("_"," ") || projectType} · Preview</p><h2 className="mt-2 text-2xl font-black">{activeProject?.title || title || "Untitled research"}</h2><p className="mt-2 text-sm text-muted-foreground">{activeProject?.description || description}</p>{previewQuestions.map((q,i)=><div key={q.id} className="mt-6"><p className="text-sm font-semibold">{i+1}. {q.label} {q.required&&<span className="text-red-500">*</span>}</p>{q.type==="long_text"?<textarea rows={3} value={String(previewAnswers[q.id]||"")} onChange={e=>setPreviewAnswers(p=>({...p,[q.id]:e.target.value}))} placeholder="Your answer" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm"/>:q.type==="short_text"||q.type==="date"||q.type==="number"||q.type==="rating"?<input type={q.type==="short_text"?"text":q.type==="rating"||q.type==="number"?"number":"date"} min={q.type==="rating"?0:undefined} max={q.type==="rating"?5:undefined} value={String(previewAnswers[q.id]||"")} onChange={e=>setPreviewAnswers(p=>({...p,[q.id]:e.target.value}))} placeholder="Your answer" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm"/>:q.type==="dropdown"?<select value={String(previewAnswers[q.id]||"")} onChange={e=>setPreviewAnswers(p=>({...p,[q.id]:e.target.value}))} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm"><option value="">Choose an option</option>{(q.options||[]).map(o=><option key={o}>{o}</option>)}</select>:<div className="mt-2 space-y-2">{(q.options||[]).map(o=><label key={o} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm"><input type={q.type==="multiple_choice"?"checkbox":"radio"} name={`preview-${q.id}`} checked={q.type==="multiple_choice"?Array.isArray(previewAnswers[q.id])&&(previewAnswers[q.id] as string[]).includes(o):previewAnswers[q.id]===o} onChange={e=>setPreviewAnswers(p=>{const old=Array.isArray(p[q.id])?p[q.id] as string[]:[];return {...p,[q.id]:q.type==="multiple_choice"?(e.target.checked?[...old,o]:old.filter(v=>v!==o)):o}})}/>{o}</label>)}</div>}</div>)}</div>{activeProject && <div className="rounded-2xl border border-border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold">Publication</p><p className="text-xs text-muted-foreground">{activeProject.status === "published" ? "Your form is live and accepting responses." : "Only you can see this draft until published."}</p></div>{activeProject.status === "published" ? <button onClick={()=>void copyLink(activeProject)} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">Copy public link</button> : <button disabled={saving} onClick={()=>void changeStatus(activeProject,"published")} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">{saving?"Publishing…":"Publish form"}</button>}</div>{activeProject.status === "published" && <><p className="mt-3 break-all rounded-lg bg-muted p-3 text-xs">{publicUrl}</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>void shareLink(activeProject,"native")} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Share…</button><button onClick={()=>void shareLink(activeProject,"whatsapp")} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">WhatsApp</button><button onClick={()=>void shareLink(activeProject,"facebook")} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Facebook</button><button onClick={()=>void shareLink(activeProject,"greenhaven")} className="rounded-lg border border-emerald-600/30 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">GreenHaven Chat</button></div></>}</div>}</section>}

    {step === "inbox" && <section className="mt-8 space-y-4"><button onClick={()=>setStep("home")} className="text-sm font-semibold text-emerald-700">← Back to workspace</button><div><h2 className="text-2xl font-black">Research Inbox</h2><p className="text-sm text-muted-foreground">{activeProject?.title} · Latest submissions</p></div>{evidence.filter(ev=>!ev.response_id).length>0&&<div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3"><p className="text-xs font-bold">Evidence awaiting a submitted response</p><p className="mt-1 text-[11px] text-muted-foreground">These files were uploaded through a public form, but the respondent has not completed the matching submission yet.</p><div className="mt-2 space-y-1">{evidence.filter(ev=>!ev.response_id).map(ev=><p key={ev.id} className="text-xs">{ev.scan_status==="clean"&&ev.verification_status!=="rejected"&&ev.verification_status!=="quarantined"?<a href={`/api/research/evidence/${ev.id}/content`} target="_blank" rel="noreferrer" className="font-semibold underline">Open {ev.media_kind}</a>:<span className="font-semibold">{ev.media_kind} · {ev.scan_status||"legacy"} / {ev.verification_status}</span>} <span className="text-muted-foreground">· {ev.mime_type}</span></p>)}</div></div>}{responses.length===0?<div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No responses received yet. Share your published link to start collecting responses.</div>:<div className="space-y-3">{responses.map((r,i)=><article key={r.id} className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-muted-foreground">RESPONSE {responses.length-i}</p><span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{r.review_status}</span></div><p className="mt-1 text-xs text-muted-foreground">{new Date(r.submitted_at).toLocaleString()}</p><div className="mt-3 space-y-3">{(activeProject?.form_schema?.questions||[]).map(q=>{const v=r.answers?.[q.id];return v===undefined?null:<div key={q.id}><p className="text-xs font-semibold text-muted-foreground">{q.label}</p><p className="mt-1 whitespace-pre-wrap text-sm">{Array.isArray(v)?v.join(", "):String(v)}</p></div>})}</div><div className="mt-4 rounded-xl border border-dashed border-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold">Evidence attachments</p><label className="cursor-pointer rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">{uploadingEvidence===r.id?"Uploading…":"＋ Add evidence"}<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,audio/webm,audio/flac,application/pdf" disabled={!!uploadingEvidence} onChange={e=>{const f=e.target.files?.[0];if(f)void attachEvidence(r.id,f);e.currentTarget.value=""}}/></label></div>{evidence.filter(ev=>ev.response_id===r.id).length===0?<p className="mt-2 text-xs text-muted-foreground">No evidence attached yet.</p>:<div className="mt-3 space-y-2">{evidence.filter(ev=>ev.response_id===r.id).map(ev=><div key={ev.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/60 p-2"><div>{ev.scan_status === "clean" ? <a href={`/api/research/evidence/${ev.id}/content`} target="_blank" rel="noreferrer" className="text-xs font-semibold underline">Open {ev.media_kind}</a> : <span className="text-xs font-semibold">{ev.media_kind} · quarantined</span>}<p className="text-[10px] text-muted-foreground">{ev.mime_type} · scan: {ev.scan_status || "legacy"} · review: {ev.verification_status}{ev.sha256 ? ` · SHA-256 ${ev.sha256.slice(0,12)}…` : ""}</p></div><div className="flex gap-1">{ev.scan_status === "clean" && ev.verification_status!=="verified"&&<button onClick={()=>void reviewEvidence(ev.id,"verified")} className="rounded-md border border-emerald-600/30 px-2 py-1 text-[10px]">Verify</button>}{ev.verification_status!=="rejected"&&<button onClick={()=>void reviewEvidence(ev.id,"rejected")} className="rounded-md border border-red-600/30 px-2 py-1 text-[10px]">Reject</button>}</div></div>)}</div>}</div></article>)}</div>}</section>}
  </main>
}
