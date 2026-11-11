/**
 * Ensure public profile projections never leak wallet/financial fields.
 */

const FORBIDDEN_PUBLIC_KEYS = new Set([
  "balance",
  "balances",
  "wallet",
  "piBalance",
  "ghcBalance",
  "availablePi",
  "reservedPi",
  "pendingPi",
  "withdrawalPin",
  "bankAccount",
  "privateKey",
  "accessToken",
  "refreshToken",
])

export function stripFinancialFieldsFromPublicProfile<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = { ...input }
  for (const key of Object.keys(out)) {
    if (FORBIDDEN_PUBLIC_KEYS.has(key)) delete out[key]
    if (/balance|wallet|payout|withdraw|secret|token/i.test(key) && key !== "displayName") {
      delete out[key]
    }
  }
  return out as T
}

export function assertNoFinancialPublicFields(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).filter(
    (k) => FORBIDDEN_PUBLIC_KEYS.has(k) || (/balance|wallet|payout|withdraw/i.test(k) && k !== "displayName"),
  )
}
