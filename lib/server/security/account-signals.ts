/**
 * Phase 2 — anti-fraud readiness signals (honest, non-KYC).
 * Uses durable Pi app uid uniqueness only. Does not claim PiVerify or legal identity.
 */

import { getByGhUserId } from "@/lib/server/identity/pi-identity-store"
import { isPiIdentityDurable } from "@/lib/server/identity/pi-identity-store"

export type AccountSignal = {
  id: string
  level: "info" | "ok" | "attention"
  title: string
  detail: string
}

export async function buildAccountSignals(userId: string): Promise<{
  ok: boolean
  signals: AccountSignal[]
  piVerifyAvailable: false
  note: string
}> {
  const signals: AccountSignal[] = []
  const uid = String(userId || "").trim()
  if (!uid) {
    return {
      ok: false,
      signals: [],
      piVerifyAvailable: false,
      note: "AUTH_REQUIRED",
    }
  }

  const durable = isPiIdentityDurable()
  signals.push({
    id: "identity_store",
    level: durable ? "ok" : "attention",
    title: durable ? "Durable Pi identity mapping" : "Identity mapping not durable",
    detail: durable
      ? "Your Pi app uid is stored server-side and is the unique login key for this app."
      : "Operators must configure Supabase identity tables for production.",
  })

  const pi = await getByGhUserId(uid)
  if (pi?.piAppUid) {
    signals.push({
      id: "pi_linked",
      level: "ok",
      title: "Pi account linked",
      detail: pi.piUsername
        ? `Verified Pi username @${pi.piUsername} is linked to this GreenHaven account.`
        : "Verified Pi app uid is linked (username not on file).",
    })
    signals.push({
      id: "duplicate_guard",
      level: "info",
      title: "One Pi app uid → one GreenHaven account",
      detail:
        "Duplicate sign-ins with the same verified Pi uid reuse this account. We do not invent multi-account merges.",
    })
  } else {
    signals.push({
      id: "pi_linked",
      level: "attention",
      title: "Pi link not found",
      detail: "Complete Pi sign-in so GreenHaven can verify your Pioneer identity server-side.",
    })
  }

  // Explicit non-claim about PiVerify
  signals.push({
    id: "piverify",
    level: "info",
    title: "PiVerify / KYC",
    detail:
      "Not integrated. If Pi opens eligibility for this app, consent UX will be added before any verification is requested. No false KYC badge is shown today.",
  })

  return {
    ok: true,
    signals,
    piVerifyAvailable: false,
    note: "Signals are informational. They do not change balances, membership, or payment status.",
  }
}
