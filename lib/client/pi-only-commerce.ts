/**
 * Client mirror of GHC_PI_ONLY_COMMERCE.
 * Prefer NEXT_PUBLIC_GHC_PI_ONLY_COMMERCE; default true for Pi ecosystem listing posture.
 */
export function isPiOnlyCommerceClient(): boolean {
  const raw = String(process.env.NEXT_PUBLIC_GHC_PI_ONLY_COMMERCE ?? "1").trim().toLowerCase()
  if (["0", "false", "no", "off"].includes(raw)) return false
  return true
}
