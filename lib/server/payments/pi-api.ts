/**
 * Pi Platform API helpers — server only.
 */

const PI_API_BASE = "https://api.minepi.com/v2"

export function getPiApiKey(): string {
  return (process.env.PI_API_KEY || process.env.PI_SERVER_API_KEY || "").trim()
}

export type PiPaymentDTO = {
  identifier?: string
  amount?: number | string
  memo?: string
  status?: {
    developer_approved?: boolean
    transaction_verified?: boolean
    developer_completed?: boolean
    cancelled?: boolean
    user_cancelled?: boolean
  }
  transaction?: { txid?: string; verified?: boolean } | null
  from_uid?: string
  user_uid?: string
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

export async function piGetPayment(paymentId: string): Promise<{
  ok: boolean
  payment?: PiPaymentDTO
  status?: number
  error?: string
}> {
  const apiKey = getPiApiKey()
  if (!apiKey) return { ok: false, error: "PI_API_KEY not configured" }

  try {
    const res = await fetch(`${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
      method: "GET",
      headers: { Authorization: `Key ${apiKey}` },
    })
    const text = await res.text()
    let data: PiPaymentDTO = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      return { ok: false, status: res.status, error: "Invalid JSON from Pi" }
    }
    if (!res.ok) {
      return { ok: false, status: res.status, error: text.slice(0, 200) }
    }
    return { ok: true, payment: data }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network" }
  }
}

export async function piApprovePayment(paymentId: string): Promise<{
  ok: boolean
  payment?: PiPaymentDTO
  status?: number
  error?: string
}> {
  const apiKey = getPiApiKey()
  if (!apiKey) return { ok: false, error: "PI_API_KEY not configured" }

  try {
    const res = await fetch(
      `${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}/approve`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    )
    const text = await res.text()
    let data: PiPaymentDTO = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = { raw: text } as PiPaymentDTO
    }
    if (!res.ok) return { ok: false, status: res.status, error: text.slice(0, 200), payment: data }
    return { ok: true, payment: data }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network" }
  }
}

export async function piCompletePayment(
  paymentId: string,
  txid: string
): Promise<{
  ok: boolean
  payment?: PiPaymentDTO
  status?: number
  error?: string
}> {
  const apiKey = getPiApiKey()
  if (!apiKey) return { ok: false, error: "PI_API_KEY not configured" }

  try {
    const res = await fetch(
      `${PI_API_BASE}/payments/${encodeURIComponent(paymentId)}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ txid }),
      }
    )
    const text = await res.text()
    let data: PiPaymentDTO = {}
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = { raw: text } as PiPaymentDTO
    }
    if (!res.ok) return { ok: false, status: res.status, error: text.slice(0, 200), payment: data }
    return { ok: true, payment: data }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network" }
  }
}

/** Compare amounts with small float tolerance */
export function amountsMatch(expected: number, actual: number | string | undefined): boolean {
  if (actual == null) return false
  const a = typeof actual === "string" ? parseFloat(actual) : actual
  if (!Number.isFinite(a)) return false
  return Math.abs(a - expected) < 1e-6
}
