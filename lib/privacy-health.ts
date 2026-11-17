import type { PrivacySettingsSlice } from "./privacy-controls"

export type PrivacyHealth = {
  score: number
  label: "Strong" | "Good" | "Needs attention"
  checks: string[]
  recommendations: string[]
}

/** Client-safe privacy posture summary. It never exposes hidden policy internals. */
export function getPrivacyHealth(settings: PrivacySettingsSlice | null | undefined): PrivacyHealth {
  const s = settings || {}
  let score = 100
  const checks: string[] = []
  const recommendations: string[] = []
  if (s.whoCanMessage === "everyone") {
    score -= 10
    recommendations.push("Limit new messages to matches or connections if you want less unsolicited contact.")
  } else checks.push("Message access is restricted.")
  if (s.whoCanDiscover === "no-one" || s.profileVisibility === "hidden") checks.push("Your profile is protected from broad discovery.")
  else if (s.whoCanDiscover === "matches-only") checks.push("Discovery is limited to closer relationships.")
  else recommendations.push("Consider limiting discovery if you want a smaller public footprint.")
  if (s.showLocation === false || s.locationPrivacy === "hidden") checks.push("Profile location is hidden.")
  else recommendations.push("Hide or reduce location precision if you do not need it on your profile.")
  if (s.onlineStatus === "hidden") checks.push("Online status is hidden.")
  else recommendations.push("Hide online status if you prefer more privacy.")
  score = Math.max(0, Math.min(100, score))
  const label = score >= 85 ? "Strong" : score >= 70 ? "Good" : "Needs attention"
  return { score, label, checks, recommendations }
}
