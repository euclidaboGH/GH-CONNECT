/**
 * Parse a deployment URL for Next metadata without letting a malformed
 * environment value crash module initialization for every route.
 * Only a credential-free HTTP(S) origin is accepted.
 */
export function resolveSafeMetadataBase(raw: string | null | undefined): URL | undefined {
  const value = typeof raw === "string" ? raw.trim() : ""
  if (!value) return undefined

  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return undefined
    if (!parsed.hostname || parsed.username || parsed.password) return undefined
    return new URL(parsed.origin)
  } catch {
    return undefined
  }
}
