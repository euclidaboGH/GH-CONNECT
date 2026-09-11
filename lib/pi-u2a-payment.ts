"use client"

/**
 * User-to-App (U2A) Pi payment primitive for GH Pay.
 * Pass intentId so approve/complete bind to server Payment Intent when available.
 * Works without intent for Pi Developer checklist / 0.01 π verification.
 */

import { getPiSandbox } from "@/lib/pi-runtime"
import { recoverIncompletePayment } from "@/lib/pi-incomplete-payment"

export type U2APaymentResult =
  | { ok: true; paymentId: string; txid?: string; intentId?: string; recovered?: boolean }
  | { ok: false; error: string; cancelled?: boolean; paymentId?: string }

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
  return Boolean(typeof window !== "undefined" && (window as any).Pi && typeof (window as any).Pi.createPayment === "function")
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
    available: Boolean((window as any).Pi && typeof (window as any).Pi.createPayment === "function"),
    hasWindowPi: Boolean(Pi),
    hasCreatePayment: Boolean((window as any).Pi && typeof (window as any).Pi.createPayment === "function"),
    hasInit: Boolean((window as any).Pi && typeof (window as any).Pi.init === "function"),
    userAgentHint: uaPi ? "pi_browser" : "unknown",
    sandboxHint: getPiSandbox(),
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

/**
 * Fire approve with retries. Pi SDK may invoke onReadyForServerApproval multiple
 * times (~every 10s) until the developer approves or the timer expires.
 * We must succeed quickly so the wallet UI unlocks for the user to sign.
 */
async function approveWithRetry(
  paymentId: string,
  intentId: string | undefined,
  authHeaders: Record<string, string>,
  maxAttempts = 4
): Promise<{ ok: boolean; status?: number; error?: string; data?: unknown }> {
  let lastError = "unknown"
  let lastStatus = 0
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const { res, data } = await postJson(
        "/api/payments/approve",
        { paymentId, intentId },
        authHeaders
      )
      lastStatus = res.status
      if (res.ok) {
        console.info("[gh-pay] approve ok", { paymentId, attempt, intentId: intentId || null })
        return { ok: true, status: res.status, data }
      }
      lastError =
        (data as { error?: string; detail?: string })?.error ||
        (data as { detail?: string })?.detail ||
        `HTTP ${res.status}`
      console.warn("[gh-pay] approve attempt failed", {
        paymentId,
        attempt,
        status: res.status,
        error: lastError,
        data,
      })
      // 503 = missing PI_API_KEY — do not spin forever
      if (res.status === 503) break
      // brief backoff before retry (SDK also retries the callback)
      await new Promise((r) => setTimeout(r, 400 + attempt * 300))
    } catch (e) {
      lastError = e instanceof Error ? e.message : "network"
      console.warn("[gh-pay] approve network error", { paymentId, attempt, error: lastError })
      await new Promise((r) => setTimeout(r, 500 + attempt * 300))
    }
  }
  return { ok: false, status: lastStatus, error: lastError }
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
  // Single runtime init — sandbox from lib/pi-env (Preview/dev → sandbox, Production → mainnet)
  try {
    const { ensurePiInitialized } = await import("@/lib/pi-runtime")
    await ensurePiInitialized()
  } catch {
    /* already initialized or unavailable — createPayment path may still fail below */
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
      void (window as any).Pi.createPayment(
        { amount, memo, metadata },
        {
          onReadyForServerApproval: (paymentId: string) => {
            // Critical path: must reach Pi Platform /approve before the ~60s timer.
            // SDK may re-invoke this callback; our side also retries.
            // If approve fails, surface a clear error to the caller instead of
            // only waiting for the wallet "Payment Expired" screen.
            void approveWithRetry(paymentId, intentId, authHeaders).then(async (result) => {
              if (result.ok) return
              console.error("[gh-pay] approve ultimately failed", {
                paymentId,
                status: result.status,
                error: result.error,
              })
              // One recovery attempt — Pi may still hold an incomplete payment we can reconcile
              try {
                const recovered = await recoverIncompletePayment({
                  paymentId,
                  identifier: paymentId,
                  metadata: intentId ? { intentId } : undefined,
                })
                if (recovered.ok) {
                  finish({
                    ok: true,
                    paymentId,
                    txid: recovered.txid || undefined,
                    intentId,
                    recovered: true,
                  } as U2APaymentResult)
                  return
                }
              } catch {
                /* fall through to error */
              }
              const statusHint =
                result.status === 503
                  ? " Server PI_API_KEY is missing or this environment cannot reach Pi approve."
                  : result.status === 401 || result.status === 403
                    ? " Session or payment intent authorization failed."
                    : result.status === 404
                      ? " Payment not found on Pi — check sandbox vs mainnet match."
                      : ""
              finish({
                ok: false,
                error:
                  (result.error || "Developer approve failed") +
                  statusHint +
                  " You can retry, or use Recover if Pi shows a pending payment.",
                paymentId,
              })
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
              // Try incomplete recovery before surfacing failure
              try {
                const recovered = await recoverIncompletePayment({
                  paymentId,
                  identifier: paymentId,
                  transaction: { txid },
                  metadata: intentId ? { intentId } : undefined,
                })
                if (recovered.ok) {
                  finish({
                    ok: true,
                    paymentId,
                    txid: recovered.txid || txid,
                    intentId,
                    recovered: true,
                  } as U2APaymentResult)
                  return
                }
              } catch {
                /* */
              }
              finish({
                ok: false,
                error:
                  (data as { error?: string }).error ||
                  "Server could not complete payment with Pi",
                paymentId,
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
