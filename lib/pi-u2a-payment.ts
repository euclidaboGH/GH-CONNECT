"use client"

/**
 * User-to-App (U2A) Pi payment primitive for GH Pay.
 * Pass intentId so approve/complete bind to server Payment Intent when available.
 * Works without intent for Pi Developer checklist / 0.01 π verification.
 */

export type U2APaymentResult =
  | { ok: true; paymentId: string; txid: string; intentId?: string }
  | { ok: false; error: string; cancelled?: boolean }

type PiPaymentCallbacks = {
  onReadyForServerApproval: (paymentId: string) => void
  onReadyForServerCompletion: (paymentId: string, txid: string) => void
  onCancel: (paymentId: string) => void
  onError: (error: Error, payment?: unknown) => void
}

type PiWindow = {
  Pi?: {
    createPayment: (
      data: { amount: number; memo: string; metadata: Record<string, unknown> },
      callbacks: PiPaymentCallbacks
    ) => Promise<unknown>
  }
}

function getPi() {
  if (typeof window === "undefined") return null
  return (window as unknown as PiWindow).Pi || null
}

/** True when the official Pi bridge exposes createPayment (Pi Browser + SDK init). */
export function isPiPaymentsAvailable(): boolean {
  const Pi = getPi() as { createPayment?: unknown; init?: unknown } | null
  return Boolean(Pi && typeof Pi.createPayment === "function")
}

export type PiPaymentsProbe = {
  available: boolean
  hasWindowPi: boolean
  hasCreatePayment: boolean
  hasInit: boolean
  userAgentHint: "pi_browser" | "unknown"
  sandboxHint: boolean | null
}

/** Diagnostic probe for UI — does not claim network success. */
export function probePiPayments(): PiPaymentsProbe {
  if (typeof window === "undefined") {
    return {
      available: false,
      hasWindowPi: false,
      hasCreatePayment: false,
      hasInit: false,
      userAgentHint: "unknown",
      sandboxHint: null,
    }
  }
  const Pi = getPi() as { createPayment?: unknown; init?: unknown } | null
  const ua = (navigator.userAgent || "").toLowerCase()
  const uaPi =
    ua.includes("picloud") ||
    ua.includes("pi browser") ||
    ua.includes("pinetwork") ||
    ua.includes("pi network")
  return {
    available: Boolean(Pi && typeof Pi.createPayment === "function"),
    hasWindowPi: Boolean(Pi),
    hasCreatePayment: Boolean(Pi && typeof Pi.createPayment === "function"),
    hasInit: Boolean(Pi && typeof Pi.init === "function"),
    userAgentHint: uaPi ? "pi_browser" : "unknown",
    sandboxHint:
      typeof process !== "undefined" && process.env.NEXT_PUBLIC_PI_SANDBOX != null
        ? process.env.NEXT_PUBLIC_PI_SANDBOX === "true"
        : null,
  }
}

/**
 * Wait for window.Pi.createPayment (SDK inject can lag first paint).
 * Resolves true when ready, false on timeout.
 */
export function waitForPiPayments(timeoutMs = 12000, intervalMs = 250): Promise<boolean> {
  if (isPiPaymentsAvailable()) return Promise.resolve(true)
  if (typeof window === "undefined") return Promise.resolve(false)
  return new Promise((resolve) => {
    const start = Date.now()
    const tick = () => {
      if (isPiPaymentsAvailable()) {
        resolve(true)
        return
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(false)
        return
      }
      window.setTimeout(tick, intervalMs)
    }
    tick()
  })
}

async function postJson(
  url: string,
  body: Record<string, unknown>,
  authHeaders: Record<string, string>
) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { res, data }
}

export async function startUserToAppPayment(options?: {
  amount?: number
  memo?: string
  metadata?: Record<string, unknown>
  /** Server payment intent id — preferred for production GH Pay */
  intentId?: string
  /** Auth headers for API calls */
  authHeaders?: Record<string, string>
}): Promise<U2APaymentResult> {
  // Give the injected SDK a moment if the user just opened the app
  if (!isPiPaymentsAvailable()) {
    await waitForPiPayments(6000, 200)
  }
  const Pi = getPi()
  if (!Pi?.createPayment) {
    const probe = probePiPayments()
    return {
      ok: false,
      error: probe.hasWindowPi
        ? "Pi bridge loaded but createPayment is unavailable. Re-open the app in Pi Browser after Pi.init completes."
        : "Pi payments only work inside the Pi Browser. Open your Vercel URL there (Develop/sandbox or production app link), not Chrome or Studio alone.",
    }
  }
  // Ensure init when available (sandbox flag from NEXT_PUBLIC_PI_SANDBOX)
  try {
    const anyPi = Pi as { init?: (c: { version: string; sandbox?: boolean }) => Promise<void> }
    if (typeof anyPi.init === "function") {
      const sandbox =
        typeof process !== "undefined" && process.env.NEXT_PUBLIC_PI_SANDBOX === "true"
      await anyPi.init({ version: "2.0", sandbox })
    }
  } catch {
    /* already initialized */
  }

  const amount = options?.amount ?? 0.01
  const memo = options?.memo ?? "GreenHaven payment"
  const intentId = options?.intentId
  const authHeaders = options?.authHeaders || {}
  const metadata = {
    purpose: "commerce",
    app: "gh-connect",
    engine: "gh_pay",
    ...(intentId ? { intentId } : {}),
    ...(options?.metadata || {}),
  }

  return new Promise((resolve) => {
    let settled = false
    const finish = (result: U2APaymentResult) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    try {
      void Pi.createPayment(
        { amount, memo, metadata },
        {
          onReadyForServerApproval: (paymentId: string) => {
            void postJson(
              "/api/payments/approve",
              { paymentId, intentId },
              authHeaders
            ).then(({ res, data }) => {
              if (!res.ok) {
                console.error("[gh-pay] approve failed", data)
              }
            })
          },
          onReadyForServerCompletion: (paymentId: string, txid: string) => {
            const tryComplete = async (attempt: number): Promise<void> => {
              const { res, data } = await postJson(
                "/api/payments/complete",
                { paymentId, txid, intentId },
                authHeaders
              )
              if (res.ok) {
                finish({ ok: true, paymentId, txid, intentId })
                return
              }
              if (attempt < 1 && (data as { retryable?: boolean }).retryable) {
                await new Promise((r) => setTimeout(r, 800))
                return tryComplete(attempt + 1)
              }
              finish({
                ok: false,
                error:
                  (data as { error?: string }).error ||
                  "Server could not complete payment with Pi",
              })
            }
            void tryComplete(0).catch((err) => {
              finish({
                ok: false,
                error: err instanceof Error ? err.message : "Complete request failed",
              })
            })
          },
          onCancel: () => {
            if (intentId) {
              void fetch(`/api/payments/intents/${encodeURIComponent(intentId)}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders },
                body: JSON.stringify({ reason: "user_cancelled" }),
              }).catch(() => {})
            }
            finish({ ok: false, error: "Payment cancelled", cancelled: true })
          },
          onError: (error: Error) => {
            finish({
              ok: false,
              error: error?.message || "Pi payment error",
            })
          },
        }
      )
    } catch (err) {
      finish({
        ok: false,
        error: err instanceof Error ? err.message : "Could not start payment",
      })
    }
  })
}
