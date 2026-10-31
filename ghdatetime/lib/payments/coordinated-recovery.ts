/**
 * Coordinated payment recovery — client helpers.
 * Never invents completion. Calls server recover + membership reconcile + event fan-out.
 */

export type RecoverIntentResult = {
  ok: boolean
  recovered?: boolean
  error?: string
  message?: string
  intent?: { id?: string; status?: string; purpose?: string; referenceId?: string }
  membership?: { granted?: boolean; error?: string }
  featureAttempts?: Array<{ feature: string; ok: boolean; code?: string; message?: string }>
}

export type CoordinatedRecoveryResult = {
  ok: boolean
  intentRecover?: RecoverIntentResult
  membershipReconcile?: { ok: boolean; granted?: boolean; message?: string; error?: string }
  fulfilment?: { ok: boolean; error?: string; message?: string; orderId?: string }
  eventsEmitted: string[]
  error?: string
}

function authHeaders(): Record<string, string> {
  try {
    // Lazy import pattern avoided for bundle simplicity — caller may pass headers.
    return {}
  } catch {
    return {}
  }
}

/** Recover a single Pi payment intent from provider state (server authoritative). */
export async function recoverPaymentIntent(
  intentId: string,
  opts?: { paymentId?: string; headers?: Record<string, string> },
): Promise<RecoverIntentResult> {
  const id = String(intentId || "").trim()
  if (!id) return { ok: false, error: "INTENT_ID_REQUIRED" }
  try {
    const res = await fetch(`/api/payments/intents/${encodeURIComponent(id)}/recover`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(opts?.headers || authHeaders()),
      },
      body: JSON.stringify({
        paymentId: opts?.paymentId ? String(opts.paymentId).trim() : undefined,
      }),
      cache: "no-store",
    })
    const data = (await res.json().catch(() => ({}))) as RecoverIntentResult
    if (!res.ok) {
      return {
        ok: false,
        error: String(data.error || `HTTP_${res.status}`),
        message: data.message,
        intent: data.intent,
      }
    }
    return {
      ok: data.ok !== false,
      recovered: Boolean(data.recovered),
      intent: data.intent,
      membership: data.membership,
      featureAttempts: data.featureAttempts,
      message: data.message,
      error: data.error,
    }
  } catch {
    return { ok: false, error: "NETWORK_ERROR", message: "Could not reach recovery service." }
  }
}

/** Membership reconcile after paid-but-free states. */
export async function reconcileMembershipPurchase(
  headers?: Record<string, string>,
): Promise<{ ok: boolean; granted?: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch("/api/membership/reconcile", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(headers || {}),
      },
      body: "{}",
      cache: "no-store",
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      granted?: boolean
      message?: string
      error?: string
    }
    if (!res.ok) {
      return { ok: false, error: String(data.error || `HTTP_${res.status}`), message: data.message }
    }
    return {
      ok: data.ok !== false,
      granted: Boolean(data.granted),
      message: data.message,
      error: data.error,
    }
  } catch {
    return { ok: false, error: "NETWORK_ERROR" }
  }
}

/**
 * Full coordinated recovery for one intent:
 * 1) recover intent from Pi
 * 2) membership reconcile when purpose is membership
 * 3) emit wallet/membership events only after server reports success
 */
export async function coordinatedRecoverPayment(
  intentId: string,
  opts?: { paymentId?: string; purpose?: string; headers?: Record<string, string> },
): Promise<CoordinatedRecoveryResult> {
  const eventsEmitted: string[] = []
  const intentRecover = await recoverPaymentIntent(intentId, opts)
  if (!intentRecover.ok) {
    return { ok: false, intentRecover, eventsEmitted, error: intentRecover.error || intentRecover.message }
  }

  let membershipReconcile: CoordinatedRecoveryResult["membershipReconcile"]
  let fulfilment: CoordinatedRecoveryResult["fulfilment"]
  const purpose = String(opts?.purpose || intentRecover.intent?.purpose || "").toLowerCase()
  const st = String(intentRecover.intent?.status || "").toUpperCase()

  // Phase 18: after recover advances to COMPLETED, run server fulfilment (membership, packs, order attach)
  if (st === "COMPLETED" || st === "FULFILLED") {
    try {
      const { fulfilPaymentIntent } = await import("@/lib/payments/fulfilment-client")
      const f = await fulfilPaymentIntent({
        intentId,
        paymentId: opts?.paymentId,
        headers: opts?.headers,
      })
      fulfilment = {
        ok: f.ok,
        error: f.error,
        message: f.message || f.featureFulfilment?.[0]?.message,
        orderId: f.orderFulfilment?.orderId,
      }
      if (f.membership?.granted) {
        membershipReconcile = { ok: true, granted: true, message: "Membership granted via fulfil" }
      }
    } catch {
      fulfilment = { ok: false, error: "FULFIL_CALL_FAILED" }
    }
  }

  if (!membershipReconcile && (purpose === "membership" || intentRecover.membership?.granted)) {
    membershipReconcile = await reconcileMembershipPurchase(opts?.headers)
  }

  try {
    window.dispatchEvent(
      new CustomEvent("ghc:payment-recovered", {
        detail: {
          intentId,
          status: intentRecover.intent?.status,
          recovered: intentRecover.recovered,
          membership: membershipReconcile?.granted || intentRecover.membership?.granted,
        },
      }),
    )
    eventsEmitted.push("ghc:payment-recovered")
    window.dispatchEvent(new CustomEvent("ghc:wallet-refresh", { detail: { reason: "payment-recovery" } }))
    eventsEmitted.push("ghc:wallet-refresh")
    if (membershipReconcile?.granted || intentRecover.membership?.granted) {
      window.dispatchEvent(new CustomEvent("ghc:membership-activated", { detail: { reason: "payment-recovery" } }))
      eventsEmitted.push("ghc:membership-activated")
    }
  } catch {
    /* non-browser or blocked */
  }

  return {
    ok: true,
    intentRecover,
    membershipReconcile,
    fulfilment,
    eventsEmitted,
  }
}

