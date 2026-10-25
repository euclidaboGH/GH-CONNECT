/**
 * Client: request server fulfilment for a COMPLETED durable payment intent.
 * Never treats client-only paymentId as authority.
 */

export type FulfilPaymentResult = {
  ok: boolean
  idempotent?: boolean
  error?: string
  message?: string
  membership?: { granted?: boolean; skipped?: boolean; tier?: string; error?: string }
  ghcPack?: { granted?: boolean; ghcAmount?: number; productId?: string; error?: string }
  featureFulfilment?: Array<{ feature: string; ok: boolean; code: string; message: string; orderId?: string }>
  orderFulfilment?: { ok: boolean; orderId?: string; error?: string } | null
  intent?: { id?: string; status?: string }
}

export async function fulfilPaymentIntent(
  input: { intentId?: string; paymentId?: string; txid?: string; headers?: Record<string, string> },
): Promise<FulfilPaymentResult> {
  const intentId = String(input.intentId || "").trim()
  const paymentId = String(input.paymentId || "").trim()
  if (!intentId && !paymentId) {
    return { ok: false, error: "intentId or paymentId required" }
  }
  try {
    const res = await fetch("/api/payments/fulfill", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(input.headers || {}),
      },
      body: JSON.stringify({
        intentId: intentId || undefined,
        paymentId: paymentId || undefined,
        txid: input.txid ? String(input.txid).trim() : undefined,
      }),
      cache: "no-store",
    })
    const data = (await res.json().catch(() => ({}))) as FulfilPaymentResult
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
      idempotent: data.idempotent,
      membership: data.membership,
      ghcPack: data.ghcPack,
      featureFulfilment: data.featureFulfilment,
      orderFulfilment: data.orderFulfilment,
      intent: data.intent,
      message: data.message,
      error: data.error,
    }
  } catch {
    return { ok: false, error: "NETWORK_ERROR", message: "Could not reach fulfilment service." }
  }
}
