/**
 * Pre-flight checklist before Pi A2U withdrawal execution.
 * All items must pass on the server; this mirrors client UX gates only.
 */

export type WithdrawAuthCheckId =
  | "session"
  | "identity_map"
  | "consent"
  | "pin"
  | "available_balance"
  | "not_reserved_preview"
  | "production_flag"

export interface WithdrawAuthCheck {
  id: WithdrawAuthCheckId
  label: string
  ok: boolean
  detail?: string
}

export function buildWithdrawalAuthorizationChecklist(input: {
  hasSession: boolean
  identityMapped: boolean
  consentGranted: boolean
  pinVerified: boolean
  availablePi: number
  requestedPi: number
  quoteReservedFunds: boolean
  productionCallsEnabled?: boolean
}): { ready: boolean; checks: WithdrawAuthCheck[] } {
  const checks: WithdrawAuthCheck[] = [
    {
      id: "session",
      label: "Signed-in session",
      ok: input.hasSession,
      detail: input.hasSession ? undefined : "Sign in to continue.",
    },
    {
      id: "identity_map",
      label: "Pi identity linked to GreenHaven account",
      ok: input.identityMapped,
      detail: input.identityMapped ? undefined : "Link and verify Pi identity before withdrawal.",
    },
    {
      id: "consent",
      label: "Payout authorization consent",
      ok: input.consentGranted,
      detail: input.consentGranted ? undefined : "Authorize payout consent in Pi Browser.",
    },
    {
      id: "pin",
      label: "Withdrawal PIN verified",
      ok: input.pinVerified,
      detail: input.pinVerified ? undefined : "Enter your withdrawal PIN.",
    },
    {
      id: "available_balance",
      label: "Requested amount within available balance",
      ok:
        Number.isFinite(input.availablePi) &&
        Number.isFinite(input.requestedPi) &&
        input.requestedPi > 0 &&
        input.requestedPi <= input.availablePi + 1e-9,
      detail: "Amount must be positive and not exceed available (non-reserved) Pi.",
    },
    {
      id: "not_reserved_preview",
      label: "Quote/consent did not reserve funds",
      ok: input.quoteReservedFunds === false,
      detail: "Preview and consent must not lock balance; reservation only on accepted payout.",
    },
  ]

  const ready = checks.every((c) => c.ok)
  return { ready, checks }
}

export function withdrawalNotReadyMessage(checks: WithdrawAuthCheck[]): string {
  const first = checks.find((c) => !c.ok)
  return first?.detail || first?.label || "Withdrawal is not ready."
}
