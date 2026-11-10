/** Reject demo/local placeholder IDs for cross-account social writes. */
export function isLikelyServerUserId(id: string): boolean {
  const s = String(id || "").trim()
  if (!s || s === "current-user") return false
  if (s.startsWith("demo-") || s.startsWith("local-") || s.startsWith("seed-")) return false
  if (s.startsWith("sample-") || s.startsWith("fixture-")) return false
  // Allow UUID-ish, Pi UIDs, gh_* ids
  return s.length >= 4
}
