/**
 * Phase 2 — Database integrity: proposal SQL must never be treated as canonical.
 * Canonical migrations live only under supabase/migrations with 14-digit version prefixes.
 * Proposals live under supabase/proposals and require explicit operator approval.
 */

export const CANONICAL_MIGRATIONS_DIR = "supabase/migrations"
export const PROPOSALS_DIR = "supabase/proposals"

/** True when a relative path is a non-canonical proposal artifact. */
export function isMigrationProposalPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\.\//, "")
  return (
    normalized.startsWith(`${PROPOSALS_DIR}/`) ||
    normalized.includes("/proposals/") ||
    /_proposal\.sql$/i.test(normalized)
  )
}

/** True when a filename is a canonical migration (14-digit version + .sql). */
export function isCanonicalMigrationFilename(filename: string): boolean {
  return /^\d{14}_[a-z0-9_]+\.sql$/i.test(filename) && !/_proposal\.sql$/i.test(filename)
}
