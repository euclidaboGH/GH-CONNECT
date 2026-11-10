import { createHmac, timingSafeEqual } from "node:crypto"

const API_BASE = "https://api.paystack.co"
const REQUEST_TIMEOUT_MS = 12_000

type PaystackEnvelope<T> = { status?: boolean; message?: string; data?: T }

export class PaystackError extends Error {
  readonly code: string
  readonly retryable: boolean
  constructor(code: string, message: string, retryable = false) {
    super(message)
    this.name = "PaystackError"
    this.code = code
    this.retryable = retryable
  }
}

export function paystackTransfersEnabled(): boolean {
  const key = String(process.env.PAYSTACK_SECRET_KEY || "").trim()
  return process.env.PAYSTACK_TRANSFERS_ENABLED === "true" && (key.startsWith("sk_test_") || key.startsWith("sk_live_"))
}

export function paystackLiveTransfersApproved(): boolean {
  const key = String(process.env.PAYSTACK_SECRET_KEY || "").trim()
  if (key.startsWith("sk_test_")) return true
  if (key.startsWith("sk_live_")) return process.env.PAYSTACK_LIVE_TRANSFERS_APPROVED === "true"
  return false
}

export function verifyPaystackSignature(rawBody: string, signature: string | null): boolean {
  const secret = String(process.env.PAYSTACK_SECRET_KEY || "").trim()
  if (!secret || !signature || !/^[a-f0-9]{128}$/i.test(signature)) return false
  const expected = createHmac("sha512", secret).update(rawBody, "utf8").digest()
  const supplied = Buffer.from(signature, "hex")
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export async function paystackRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const secret = String(process.env.PAYSTACK_SECRET_KEY || "").trim()
  if (!secret) throw new PaystackError("PAYSTACK_NOT_CONFIGURED", "Bank transfer provider is not configured.")
  if (!path.startsWith("/") || path.includes("..")) throw new PaystackError("PAYSTACK_INVALID_PATH", "Invalid provider path.")
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers || {}),
      },
      cache: "no-store",
      signal: init.signal || AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new PaystackError("PAYSTACK_NETWORK_UNAVAILABLE", "Bank provider could not be reached. Reconcile using the same reference before retrying.", true)
  }
  const payload = await response.json().catch(() => null) as PaystackEnvelope<T> | null
  if (!response.ok || !payload || payload.status !== true || payload.data === undefined) {
    const retryable = response.status === 408 || response.status === 429 || response.status >= 500
    throw new PaystackError("PAYSTACK_REQUEST_FAILED", String(payload?.message || `Provider request failed (${response.status}).`), retryable)
  }
  return payload.data
}

export type PaystackBank = { name: string; code: string; active?: boolean; country?: string; currency?: string; type?: string }
export type PaystackResolvedAccount = { account_number: string; account_name: string }
export type PaystackRecipient = {
  recipient_code: string
  type: string
  name: string
  currency: string
  active: boolean
  details?: { account_number?: string; account_name?: string | null; bank_code?: string; bank_name?: string }
}
export type PaystackTransfer = {
  id?: number
  reference: string
  amount: number
  currency: string
  status: string
  transfer_code?: string
  recipient?: number | string | { recipient_code?: string }
  reason?: string
  domain?: string
}

export async function listNigerianBanks(): Promise<PaystackBank[]> {
  const result = await paystackRequest<PaystackBank[]>("/bank?currency=NGN&perPage=100")
  return result.filter((bank) => bank.active !== false && bank.currency === "NGN" && bank.code && bank.name)
}

export async function resolveNubanAccount(accountNumber: string, bankCode: string): Promise<PaystackResolvedAccount> {
  const query = new URLSearchParams({ account_number: accountNumber, bank_code: bankCode })
  return paystackRequest<PaystackResolvedAccount>(`/bank/resolve?${query.toString()}`)
}

export async function createNubanRecipient(input: { name: string; accountNumber: string; bankCode: string; description: string }): Promise<PaystackRecipient> {
  return paystackRequest<PaystackRecipient>("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({ type: "nuban", name: input.name, account_number: input.accountNumber, bank_code: input.bankCode, currency: "NGN", description: input.description.slice(0, 100) }),
  })
}

export async function initiateNgnTransfer(input: { amountKobo: number; recipientCode: string; reference: string; reason: string }): Promise<PaystackTransfer> {
  if (!Number.isSafeInteger(input.amountKobo) || input.amountKobo < 100) throw new PaystackError("INVALID_TRANSFER_AMOUNT", "Transfer amount must be at least ₦1.00 in integer kobo.")
  if (!/^RCP_[A-Za-z0-9]+$/.test(input.recipientCode)) throw new PaystackError("INVALID_RECIPIENT_CODE", "Verified bank beneficiary is required.")
  if (!/^[a-z0-9_-]{16,50}$/.test(input.reference)) throw new PaystackError("INVALID_TRANSFER_REFERENCE", "A stable idempotent transfer reference is required.")
  return paystackRequest<PaystackTransfer>("/transfer", {
    method: "POST",
    body: JSON.stringify({ source: "balance", amount: input.amountKobo, recipient: input.recipientCode, reference: input.reference, reason: input.reason.slice(0, 100) || "GreenHaven seller payout", currency: "NGN" }),
  })
}

export async function fetchNgnTransfer(reference: string): Promise<PaystackTransfer> {
  if (!/^[a-z0-9_-]{16,50}$/.test(reference)) throw new PaystackError("INVALID_TRANSFER_REFERENCE", "Invalid transfer reference.")
  return paystackRequest<PaystackTransfer>(`/transfer/verify/${encodeURIComponent(reference)}`)
}
