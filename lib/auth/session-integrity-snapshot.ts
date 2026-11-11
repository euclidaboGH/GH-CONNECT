/**
 * Session integrity snapshot for UI — not a substitute for server auth.
 */

export const SESSION_MAX_ACTIVE_DEFAULT = 8

export interface SessionIntegritySnapshot {
  hasUser: boolean
  userId: string | null
  stepUpLikelyRequiredForWithdraw: boolean
  maxActiveSessions: number
}

export function buildSessionIntegritySnapshot(input: {
  userId?: string | null
  hasPiToken?: boolean
}): SessionIntegritySnapshot {
  const userId = input.userId ? String(input.userId) : null
  return {
    hasUser: Boolean(userId),
    userId,
    stepUpLikelyRequiredForWithdraw: true,
    maxActiveSessions: SESSION_MAX_ACTIVE_DEFAULT,
  }
}
