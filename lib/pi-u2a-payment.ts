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

export function isPiPaymentsAvailable(): boolean {
  const Pi = getPi()
  return Boolean(Pi && typeof Pi.createPayment === "function")
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

export function startUserToAppPayment(options?: {
  amount?: number
  memo?: string
  metadata?: Record<string, unknown>
  /** Server payment intent id — preferred for production GH Pay */
  intentId?: string
  /** Auth headers for API calls */
  authHeaders?: Record<string, string>
}): Promise<U2APaymentResult> {
  const Pi = getPi()
  if (!Pi?.createPayment) {
    return Promise.resolve({
      ok: false,
      error:
        "Pi payments only work inside the Pi Browser. Open your production URL there (not App Studio).",
    })
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
