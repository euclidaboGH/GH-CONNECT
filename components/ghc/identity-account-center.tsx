"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, RefreshCw, ShieldCheck, UserRound, Eye, AlertCircle } from "lucide-react"

type IdentitySnapshot = {
  authenticated?: boolean
  serverVerified?: boolean
  greenHavenId?: string
  piUsername?: string | null
  verifiedAt?: string | null
  onboardingCompleted?: boolean
}
type ProfilePayload = Record<string, unknown>

const PROFILE_FIELDS = [
  { key: "displayName", label: "Display name" },
  { key: "bio", label: "Bio" },
  { key: "photos", label: "Profile photo" },
  { key: "interests", label: "Interests" },
] as const

function hasValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value)
}

export function IdentityAccountCenter() {
  const [identity, setIdentity] = useState<IdentitySnapshot | null>(null)
  const [profile, setProfile] = useState<ProfilePayload | null>(null)
  const [audience, setAudience] = useState<"public" | "members" | "private">("public")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const [identityResponse, profileResponse] = await Promise.all([
        fetch("/api/identity/me", { credentials: "include", cache: "no-store" }),
        fetch("/api/profile/me", { credentials: "include", cache: "no-store" }),
      ])
      const [identityData, profileData] = await Promise.all([
        identityResponse.json().catch(() => ({})),
        profileResponse.json().catch(() => ({})),
      ])
      if (identityResponse.status === 401 || profileResponse.status === 401) {
        throw new Error("Your session has expired. Sign in again to refresh your account status.")
      }
      if (!identityResponse.ok || !identityData.ok) throw new Error(String(identityData.error || "Identity status is temporarily unavailable."))
      if (!profileResponse.ok || !profileData.ok) throw new Error(String(profileData.error || "Profile status is temporarily unavailable."))
      setIdentity(identityData)
      setProfile(profileData.profile && typeof profileData.profile === "object" ? profileData.profile : {})
    } catch (e) {
      setError(e instanceof Error ? e.message : "Account status is temporarily unavailable.")
    } finally {
      setLoading(false)
    }
  }, [loading])

  useEffect(() => { void refresh() }, []) // intentional initial load
  const completed = useMemo(() => PROFILE_FIELDS.filter((field) => hasValue(profile?.[field.key])).length, [profile])
  const percentage = Math.round((completed / PROFILE_FIELDS.length) * 100)

  const exportData = async () => {
    setMessage(null)
    try {
      const response = await fetch("/api/profile/export", { credentials: "include", cache: "no-store" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.ok) throw new Error(String(data.error || "Profile export is unavailable."))
      const blob = new Blob([JSON.stringify(data.export, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "greenhaven-personal-data.json"
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setMessage("Your available profile and identity data export was prepared.")
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Export failed. Please retry.")
    }
  }

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-border/60 bg-card" aria-label="Identity and account center">
      <div className="flex items-start justify-between gap-3 border-b border-border/50 p-3.5">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold"><ShieldCheck size={16} aria-hidden /> Identity & account center</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Server-confirmed account status, profile readiness, privacy preview and personal-data export.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} aria-label="Refresh account status" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></button>
      </div>
      {error ? <div className="m-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs" role="alert"><p className="flex items-center gap-2 font-semibold"><AlertCircle size={14} />{error}</p><button type="button" onClick={() => void refresh()} className="mt-2 min-h-10 rounded-lg border px-3 font-semibold">Retry status check</button></div> : null}
      <div className="grid gap-3 p-3.5 sm:grid-cols-2">
        <div className="rounded-xl bg-muted/40 p-3">
          <p className="flex items-center gap-2 text-xs font-bold"><UserRound size={14} /> Sign-in & identity</p>
          <p className="mt-2 text-xs">{identity?.authenticated ? "Signed-in session confirmed" : loading ? "Checking session…" : "Session status not confirmed"}</p>
          <p className="mt-1 break-all text-[11px] text-muted-foreground">GreenHaven ID: {identity?.greenHavenId || "Not available"}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Pi identity: {identity?.serverVerified ? `Verified${identity.piUsername ? ` · @${identity.piUsername}` : ""}` : "Not server-verified"}</p>
          {identity?.verifiedAt ? <p className="mt-1 text-[10px] text-muted-foreground">Verified on {new Date(identity.verifiedAt).toLocaleDateString()}</p> : null}
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">A verified Pi identity does not itself grant payout authorization or withdrawal eligibility.</p>
        </div>
        <div className="rounded-xl bg-muted/40 p-3">
          <p className="text-xs font-bold">Profile completeness</p>
          <p className="mt-2 text-lg font-black">{percentage}%</p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} aria-label="Profile completeness"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${percentage}%` }} /></div>
          <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">{PROFILE_FIELDS.map((field) => <li key={field.key}>{hasValue(profile?.[field.key]) ? "✓" : "○"} {field.label}</li>)}</ul>
        </div>
        <div className="rounded-xl border border-border/60 p-3">
          <p className="flex items-center gap-2 text-xs font-bold"><Eye size={14} /> Profile visibility preview</p>
          <label className="mt-2 block text-[11px] text-muted-foreground" htmlFor="identity-audience">Preview audience (does not change privacy settings)</label>
          <select id="identity-audience" value={audience} onChange={(event) => setAudience(event.target.value as typeof audience)} className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-2 text-xs">
            <option value="public">Public visitor</option><option value="members">Signed-in members</option><option value="private">Only me</option>
          </select>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{audience === "public" ? "Preview: public-facing name, photo and bio may be visible according to the current server-enforced profile rules." : audience === "members" ? "Preview: signed-in members may see fields permitted by the current profile visibility rules." : "Preview: private view is a planning aid; it does not hide fields or alter server permissions."}</p>
        </div>
        <div className="rounded-xl border border-border/60 p-3">
          <p className="text-xs font-bold">Personal data</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Export the profile and identity summary currently available through authenticated server APIs.</p>
          <button type="button" onClick={() => void exportData()} className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Download size={14} /> Export my data</button>
          {message ? <p role="status" className="mt-2 text-[11px] text-muted-foreground">{message}</p> : null}
        </div>
      </div>
    </section>
  )
}
