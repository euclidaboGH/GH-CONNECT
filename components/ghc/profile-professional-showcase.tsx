"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Award, BriefcaseBusiness, Building2, ExternalLink, Globe2, Layers3, Sparkles } from "lucide-react"
import type { Profile } from "@/lib/ghc-types"
import { IdentityService } from "@/lib/identity/identity-service"
import { LazyImage } from "./lazy-image"

type AchievementRow = { achievementId: string; unlockedAt: number; sourceEvent?: string | null }
type AchievementResponse = { ok?: boolean; durable?: boolean; achievements?: AchievementRow[] }

function cleanText(value: unknown, max = 180): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : ""
}

function safePortfolioUrl(value: unknown): string | null {
  const raw = cleanText(value, 2048)
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== "https:" || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

const ACHIEVEMENT_PRESENTATION: Record<string, { title: string; description: string; icon: string; rarity: "common" | "uncommon" | "rare" | "epic" }> = {
  profile_builder: { title: "Profile Builder", description: "Complete your profile identity", icon: "🧱", rarity: "common" },
  community_builder: { title: "Community Builder", description: "Create or actively lead a community", icon: "🏘️", rarity: "rare" },
  helpful_contributor: { title: "Helpful Contributor", description: "Make meaningful comments across the platform", icon: "💬", rarity: "uncommon" },
  trusted_seller: { title: "Trusted Seller", description: "Complete marketplace sales with positive outcomes", icon: "🛡️", rarity: "rare" },
  creator: { title: "Creator", description: "Publish quality posts consistently", icon: "✍️", rarity: "uncommon" },
  early_member: { title: "Early Member", description: "Joined during the early GreenHaven period", icon: "🌱", rarity: "epic" },
  mentor: { title: "Mentor", description: "Support others through mentorship matching", icon: "🎓", rarity: "rare" },
  top_contributor: { title: "Top Contributor", description: "Sustained high-quality platform contribution", icon: "🏆", rarity: "epic" },
  marketplace_milestone: { title: "Marketplace Milestone", description: "Reach a marketplace activity milestone", icon: "🛍️", rarity: "uncommon" },
  profile_complete: { title: "Profile Complete", description: "Fill required profile fields", icon: "✅", rarity: "common" },
  first_post: { title: "First Post", description: "Publish your first post", icon: "📝", rarity: "common" },
  "10_posts": { title: "Active Creator", description: "Publish 10 posts", icon: "📚", rarity: "uncommon" },
  verified: { title: "Verified Member", description: "Account verification completed", icon: "✓", rarity: "uncommon" },
}

function achievementPresentation(id: string) {
  return ACHIEVEMENT_PRESENTATION[id] || {
    title: id.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()).slice(0, 64),
    description: "A GreenHaven achievement recorded for this account.", icon: "✦", rarity: "common" as const,
  }
}

type ShowcaseProfile = { displayName?: string; profession?: string; profileMode?: Profile["profileMode"]; professional?: Profile["professional"]; business?: Profile["business"]; skills?: string[]; profilePayload?: Record<string, unknown> }

export function ProfileProfessionalShowcase({ profile, onEdit, onSave, readOnly = false }: { profile: ShowcaseProfile; onEdit?: () => void; onSave?: (patch: Partial<Profile>) => Promise<void>; readOnly?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [draft, setDraft] = useState(() => ({
    mode: profile.profileMode || "social",
    businessName: profile.business?.businessName || "", category: profile.business?.category || "",
    businessAbout: profile.business?.about || "", businessServices: (profile.business?.services || []).join(", "),
    businessLocation: profile.business?.locationLabel || "", hours: profile.business?.hours || "",
    title: profile.professional?.title || profile.profession || "", about: profile.professional?.about || "",
    skills: [...new Set([...(profile.professional?.skills || []), ...(profile.skills || [])])].join(", "),
    services: (profile.professional?.services || []).join(", "),
    professionalInterests: (profile.professional?.professionalInterests || []).join(", "),
    location: profile.professional?.locationLabel || "",
    portfolio: (profile.professional?.portfolio || []).map((item) => [item.title, item.url || "", item.description || "", item.mediaUrl || ""].join(" | ")).join("\n"),
  }))
  const updateDraft = (key: keyof typeof draft, value: string) => setDraft((current) => ({ ...current, [key]: value }))
  const beginEdit = () => {
    setDraft({
      mode: profile.profileMode || "social",
      businessName: profile.business?.businessName || "", category: profile.business?.category || "",
      businessAbout: profile.business?.about || "", businessServices: (profile.business?.services || []).join(", "),
      businessLocation: profile.business?.locationLabel || "", hours: profile.business?.hours || "",
      title: profile.professional?.title || profile.profession || "", about: profile.professional?.about || "",
      skills: [...new Set([...(profile.professional?.skills || []), ...(profile.skills || [])])].join(", "),
      services: (profile.professional?.services || []).join(", "),
      professionalInterests: (profile.professional?.professionalInterests || []).join(", "),
      location: profile.professional?.locationLabel || "",
      portfolio: (profile.professional?.portfolio || []).map((item) => [item.title, item.url || "", item.description || "", item.mediaUrl || ""].join(" | ")).join("\n"),
    })
    setSaveError("")
    setEditing(true)
  }
  const splitList = (value: string, max: number, length: number) => [...new Set(value.split(",").map((item) => cleanText(item, length)).filter(Boolean))].slice(0, max)
  const saveIdentity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!onSave || saving) return
    setSaving(true); setSaveError("")
    const professional = {
      ...(profile.professional || {}), title: cleanText(draft.title, 100), about: cleanText(draft.about, 800),
      skills: splitList(draft.skills, 40, 48), services: splitList(draft.services, 20, 100),
      professionalInterests: splitList(draft.professionalInterests, 20, 64), locationLabel: cleanText(draft.location, 100),
      portfolio: draft.portfolio.split("\n").map((line) => line.split("|").map((part) => part.trim())).filter((parts) => parts[0]).slice(0, 10).map(([title, url, description, mediaUrl]) => ({ title: cleanText(title, 90), url: safePortfolioUrl(url) || undefined, description: cleanText(description, 360), mediaUrl: safePortfolioUrl(mediaUrl) || undefined })),
    }
    const business = {
      ...(profile.business || {}), businessName: cleanText(draft.businessName, 100), category: cleanText(draft.category, 80),
      about: cleanText(draft.businessAbout, 800), services: splitList(draft.businessServices, 20, 100),
      locationLabel: cleanText(draft.businessLocation, 100), hours: cleanText(draft.hours, 100),
    }
    const profileMode = draft.mode === "business" || draft.mode === "professional" ? draft.mode : "social"
    const patch = { profileMode, professional, business, profilePayload: { ...(profile.profilePayload || {}), profileMode, professional, business } } as Partial<Profile>
    try { await onSave(patch); setEditing(false) }
    catch (error) { setSaveError(error instanceof Error ? error.message : "Your identity could not be saved. Please try again.") }
    finally { setSaving(false) }
  }
  const professional = profile.professional
  const business = profile.business
  const mode = profile.profileMode || "social"
  const skills = useMemo(() => [...new Set([...(professional?.skills || []), ...(profile.skills || [])].map((v) => cleanText(v, 48)).filter(Boolean))].slice(0, 8), [professional?.skills, profile.skills])
  const services = useMemo(() => [...new Set([...(professional?.services || []), ...(business?.services || [])].map((v) => cleanText(v, 80)).filter(Boolean))].slice(0, 6), [professional?.services, business?.services])
  const experience = useMemo(() => (professional?.experience || []).slice(0, 3).map((item) => ({
    role: cleanText(item.role, 90), organization: cleanText(item.organization, 90),
    period: [cleanText(item.from, 24), cleanText(item.to || "Present", 24)].filter(Boolean).join(" – "),
    summary: cleanText(item.summary, 180),
  })).filter((item) => item.role), [professional?.experience])
  const portfolio = useMemo(() => (professional?.portfolio || []).slice(0, 6).map((item) => ({
    title: cleanText(item.title, 90) || "Portfolio item",
    description: cleanText(item.description, 180),
    url: safePortfolioUrl(item.url),
    mediaUrl: safePortfolioUrl(item.mediaUrl),
  })), [professional?.portfolio])
  const isBusiness = mode === "business" || (!profile.profileMode && Boolean(business?.businessName))
  const isProfessional = mode === "professional" || (!profile.profileMode && Boolean(professional?.title || profile.profession))
  const hasDetails = isBusiness
    ? Boolean(business?.businessName || business?.about || business?.services?.length)
    : isProfessional
      ? Boolean(professional?.title || professional?.about || skills.length || services.length || portfolio.length || experience.length)
      : false

  if (!isBusiness && !isProfessional && !hasDetails) {
    return (
      <section className="mt-3 rounded-[1.35rem] border border-dashed border-border bg-card/70 p-4" aria-label="Professional identity">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles size={18} aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold">Build your professional identity</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Showcase your work, skills, services or business on the same GreenHaven account. You stay in control of what you publish.</p>
            {!readOnly ? <button type="button" onClick={() => onSave ? beginEdit() : onEdit?.()} className="mt-3 inline-flex min-h-10 items-center rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">Set up identity</button> : null}
          </div>
        </div>
      </section>
    )
  }

  return (
    <>
    <section className="mt-3 overflow-hidden rounded-[1.35rem] border border-border/70 bg-card shadow-[var(--gh-card-shadow)]" aria-label={isBusiness ? "Business identity" : "Professional identity"}>
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3.5">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">{isBusiness ? <Building2 size={18} aria-hidden /> : <BriefcaseBusiness size={18} aria-hidden />}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-sm font-bold">{isBusiness ? cleanText(business?.businessName, 100) || profile.displayName : cleanText(professional?.title, 100) || cleanText(profile.profession, 100) || "Professional profile"}</h3>
            </div>
            <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{isBusiness ? cleanText(business?.category, 70) || "Business identity" : "Professional identity"}</p>
          </div>
        </div>
        {!readOnly ? <button type="button" onClick={() => onSave ? beginEdit() : onEdit?.()} className="min-h-9 shrink-0 rounded-full border border-border px-3 text-[10px] font-bold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Edit</button> : null}
      </div>
      {(business?.about || professional?.about) ? <p className="px-4 pt-3 text-xs leading-relaxed text-muted-foreground">{cleanText(isBusiness ? business?.about : professional?.about, 600)}</p> : null}
      {(business?.locationLabel || professional?.locationLabel || business?.hours) ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pt-3 text-[10px] text-muted-foreground">
          {(business?.locationLabel || professional?.locationLabel) ? <span className="inline-flex items-center gap-1"><Globe2 size={12} aria-hidden />{cleanText(business?.locationLabel || professional?.locationLabel, 90)}</span> : null}
          {business?.hours ? <span>{cleanText(business.hours, 90)}</span> : null}
        </div>
      ) : null}
      {services.length > 0 ? <div className="px-4 pt-3"><p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Services</p><div className="mt-1.5 flex flex-wrap gap-1.5">{services.map((item) => <span key={item} className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-semibold">{item}</span>)}</div></div> : null}
      {skills.length > 0 ? <div className="px-4 pt-3"><p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Skills</p><div className="mt-1.5 flex flex-wrap gap-1.5">{skills.map((item) => <span key={item} className="rounded-full bg-primary/8 px-2.5 py-1 text-[10px] font-semibold text-foreground">{item}</span>)}</div></div> : null}
      {experience.length > 0 ? <div className="px-4 pt-3"><p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Experience</p><div className="space-y-2">{experience.map((item, index) => <article key={`${item.role}-${index}`} className="border-l-2 border-primary/25 pl-3"><h4 className="text-xs font-bold">{item.role}</h4>{item.organization ? <p className="text-[10px] text-muted-foreground">{item.organization}</p> : null}{item.period ? <p className="text-[9px] text-muted-foreground">{item.period}</p> : null}{item.summary ? <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{item.summary}</p> : null}</article>)}</div></div> : null}
      {portfolio.length > 0 ? <div className="px-4 pb-4 pt-3"><p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground"><Layers3 size={12} aria-hidden /> Selected work</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{portfolio.map((item, index) => <article key={`${item.title}-${index}`} className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-background/70">{item.mediaUrl ? <div className="relative aspect-[16/9] overflow-hidden bg-muted"><LazyImage src={item.mediaUrl} alt={item.title} className="h-full w-full object-cover" /></div> : null}<div className="p-3"><h4 className="truncate text-xs font-bold">{item.title}</h4>{item.description ? <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">{item.description}</p> : null}{item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="mt-2 inline-flex min-h-8 items-center gap-1 text-[10px] font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Open project <ExternalLink size={11} aria-hidden /></a> : <p className="mt-2 text-[9px] text-muted-foreground">Project details</p>}</div></article>)}</div></div> : null}
    </section>
    {editing && !readOnly ? <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditing(false) }}>
      <form onSubmit={saveIdentity} className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.5rem] border border-border bg-card shadow-2xl sm:rounded-[1.5rem]" role="dialog" aria-modal="true" aria-labelledby="gh-professional-editor-title">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><div><h3 id="gh-professional-editor-title" className="text-sm font-bold">Edit professional identity</h3><p className="mt-0.5 text-[10px] text-muted-foreground">One GreenHaven account for your personal and professional presence.</p></div><button type="button" disabled={saving} onClick={() => setEditing(false)} className="min-h-10 rounded-full px-3 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Close</button></header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <label className="block text-xs font-semibold">Profile presentation<select value={draft.mode} onChange={(event) => updateDraft("mode", event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"><option value="social">Personal / social</option><option value="professional">Professional / creator</option><option value="business">Business</option></select></label>
          <section className="space-y-2"><h4 className="text-xs font-bold">Professional profile</h4><label className="block text-[10px] font-semibold">Professional title<input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} maxLength={100} className="mt-1 block min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" placeholder="e.g. Product designer" /></label><label className="block text-[10px] font-semibold">About your work<textarea value={draft.about} onChange={(event) => updateDraft("about", event.target.value)} maxLength={800} rows={3} className="mt-1 block w-full rounded-xl border border-border bg-background p-3 text-sm" placeholder="What do you create, build or specialize in?" /></label><label className="block text-[10px] font-semibold">Skills (comma separated)<input value={draft.skills} onChange={(event) => updateDraft("skills", event.target.value)} maxLength={1200} className="mt-1 block min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label><label className="block text-[10px] font-semibold">Services (comma separated)<input value={draft.services} onChange={(event) => updateDraft("services", event.target.value)} maxLength={1200} className="mt-1 block min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label><label className="block text-[10px] font-semibold">Professional interests (comma separated)<input value={draft.professionalInterests} onChange={(event) => updateDraft("professionalInterests", event.target.value)} maxLength={1200} className="mt-1 block min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label><label className="block text-[10px] font-semibold">Professional location<input value={draft.location} onChange={(event) => updateDraft("location", event.target.value)} maxLength={100} className="mt-1 block min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label><label className="block text-[10px] font-semibold">Portfolio (one item per line: title | https://link | description | https://image)<textarea value={draft.portfolio} onChange={(event) => updateDraft("portfolio", event.target.value)} maxLength={8000} rows={4} className="mt-1 block w-full rounded-xl border border-border bg-background p-3 text-sm" placeholder="Brand identity | https://example.com | Visual identity project | https://example.com/cover.jpg" /></label></section>
          <section className="space-y-2"><h4 className="text-xs font-bold">Business profile</h4><label className="block text-[10px] font-semibold">Business name<input value={draft.businessName} onChange={(event) => updateDraft("businessName", event.target.value)} maxLength={100} className="mt-1 block min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label><label className="block text-[10px] font-semibold">Category<input value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} maxLength={80} className="mt-1 block min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label><label className="block text-[10px] font-semibold">Business description<textarea value={draft.businessAbout} onChange={(event) => updateDraft("businessAbout", event.target.value)} maxLength={800} rows={3} className="mt-1 block w-full rounded-xl border border-border bg-background p-3 text-sm" /></label><label className="block text-[10px] font-semibold">Business services (comma separated)<input value={draft.businessServices} onChange={(event) => updateDraft("businessServices", event.target.value)} maxLength={1200} className="mt-1 block min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><label className="block text-[10px] font-semibold">Location<input value={draft.businessLocation} onChange={(event) => updateDraft("businessLocation", event.target.value)} maxLength={100} className="mt-1 block min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label><label className="block text-[10px] font-semibold">Operating hours<input value={draft.hours} onChange={(event) => updateDraft("hours", event.target.value)} maxLength={100} className="mt-1 block min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label></div></section>
          {saveError ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{saveError}</p> : null}
        </div>
        <footer className="flex gap-2 border-t border-border p-3"><button type="button" disabled={saving} onClick={() => setEditing(false)} className="min-h-11 flex-1 rounded-full border border-border text-xs font-bold">Cancel</button><button type="submit" disabled={saving || !onSave} className="min-h-11 flex-1 rounded-full bg-primary text-xs font-bold text-primary-foreground disabled:opacity-60">{saving ? "Saving…" : "Save identity"}</button></footer>
      </form>
    </div> : null}
    </>
  )
}

export function ProfileAchievementShowcase() {
  const [rows, setRows] = useState<AchievementRow[]>([])
  const [durable, setDurable] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const requestRef = useRef<AbortController | null>(null)
  const identityRef = useRef("")

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const identity = IdentityService.getCurrentUserId()
      const controller = new AbortController()
      requestRef.current?.abort()
      requestRef.current = controller
      setLoading(true)
      try {
        const response = await fetch("/api/profile/achievements", { credentials: "include", cache: "no-store", signal: controller.signal })
        const data = await response.json().catch(() => ({})) as AchievementResponse
        if (!response.ok || !data.ok) throw new Error("Achievements unavailable")
        if (!mounted || controller.signal.aborted || IdentityService.getCurrentUserId() !== identity) return
        const unique = new Map<string, AchievementRow>()
        for (const row of Array.isArray(data.achievements) ? data.achievements : []) {
          const id = cleanText(row?.achievementId, 80)
          if (!id || unique.has(id)) continue
          unique.set(id, { achievementId: id, unlockedAt: Number(row.unlockedAt) || 0 })
        }
        setRows([...unique.values()].sort((a, b) => b.unlockedAt - a.unlockedAt).slice(0, 6))
        setDurable(data.durable === true)
      } catch {
        if (mounted && !controller.signal.aborted && IdentityService.getCurrentUserId() === identity) setDurable(null)
      } finally {
        if (mounted && !controller.signal.aborted && IdentityService.getCurrentUserId() === identity) setLoading(false)
      }
    }
    identityRef.current = IdentityService.getCurrentUserId()
    void load()
    const unsubscribe = IdentityService.subscribe((identity) => {
      if (identity.userId === identityRef.current) return
      identityRef.current = identity.userId
      requestRef.current?.abort()
      setRows([])
      setDurable(null)
      void load()
    })
    return () => { mounted = false; unsubscribe(); requestRef.current?.abort(); requestRef.current = null }
  }, [])

  if (loading && rows.length === 0) return <div className="mt-3 h-24 animate-pulse rounded-[1.25rem] bg-muted/50" role="status" aria-label="Loading achievements"><span className="sr-only">Loading achievements</span></div>
  if (durable === null && rows.length === 0) return null
  return (
    <section className="mt-3 rounded-[1.25rem] border border-border/70 bg-card p-4 shadow-[var(--gh-card-shadow)]" aria-label="Achievements">
      <div className="flex items-center justify-between gap-3"><div><h3 className="flex items-center gap-1.5 text-sm font-bold"><Award size={15} className="text-primary" aria-hidden /> Achievements</h3><p className="mt-0.5 text-[10px] text-muted-foreground">Milestones recorded by GreenHaven’s achievement service.</p></div><span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{rows.length} shown</span></div>
      {rows.length ? <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{rows.map((row) => { const meta = achievementPresentation(row.achievementId); const rarityClass = meta.rarity === "epic" ? "border-amber-400/40 bg-amber-500/5" : meta.rarity === "rare" ? "border-violet-400/35 bg-violet-500/5" : meta.rarity === "uncommon" ? "border-sky-400/30 bg-sky-500/5" : "border-border/70 bg-background/70"; return <article key={row.achievementId} className={`flex min-w-0 items-start gap-2.5 rounded-xl border p-3 ${rarityClass}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-lg shadow-sm" aria-hidden>{meta.icon}</span><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-bold">{meta.title}</span><span className="mt-0.5 block line-clamp-2 text-[9px] leading-relaxed text-muted-foreground">{meta.description}</span><span className="mt-1.5 flex items-center justify-between gap-2"><span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">{meta.rarity}</span><span className="text-[9px] text-muted-foreground">{row.unlockedAt > 0 ? new Date(row.unlockedAt).toLocaleDateString() : "Earned"}</span></span></span></article> })}</div> : <p className="mt-3 rounded-xl bg-muted/50 px-3 py-3 text-[11px] text-muted-foreground">Your earned milestones will appear here as you contribute across GreenHaven.</p>}
      {durable === false ? <p className="mt-2 text-[9px] text-muted-foreground">Achievement data is currently session-backed and may not persist across deployments.</p> : null}
    </section>
  )
}
