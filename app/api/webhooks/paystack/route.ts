import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { verifyPaystackSignature } from "@/lib/server/payouts/paystack"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } })

type TransferWebhook = { event?: string; data?: { id?: number | string; reference?: string; amount?: number; currency?: string; status?: string; transfer_code?: string; recipient?: string | number | { recipient_code?: string } } }

export async function POST(request: Request) {
  const raw = await request.text()
  if (raw.length > 256_000) return reply({ ok: false, error: "WEBHOOK_PAYLOAD_TOO_LARGE" }, 413)
  if (!verifyPaystackSignature(raw, request.headers.get("x-paystack-signature"))) return reply({ ok: false, error: "INVALID_WEBHOOK_SIGNATURE" }, 401)
  let event: TransferWebhook
  try { event = JSON.parse(raw) as TransferWebhook } catch { return reply({ ok: false, error: "INVALID_WEBHOOK_JSON" }, 400) }
  const eventName = String(event.event || "")
  if (!new Set(["transfer.success", "transfer.failed", "transfer.reversed"]).has(eventName)) return reply({ ok: true, ignored: true })
  const data = event.data
  const reference = String(data?.reference || "")
  const amountKobo = Number(data?.amount)
  const currency = String(data?.currency || "")
  const providerTransferId = String(data?.id || "")
  const transferCode = String(data?.transfer_code || "")
  if (!/^ghb_[a-f0-9]{32}$/.test(reference) || !Number.isSafeInteger(amountKobo) || amountKobo < 100 || currency !== "NGN" || !providerTransferId) {
    return reply({ ok: false, error: "INVALID_TRANSFER_EVENT_BINDING" }, 400)
  }
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return reply({ ok: false, error: "PAYOUT_SERVICE_UNAVAILABLE" }, 503)
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/gh_bank_payout_apply_webhook`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
      body: JSON.stringify({
        p_event_key: `${eventName}:${providerTransferId}`.slice(0, 180), p_event_name: eventName,
        p_provider_reference: reference, p_provider_transfer_id: providerTransferId, p_transfer_code: transferCode,
        p_amount_kobo: amountKobo, p_currency: currency, p_evidence_hash: createHash("sha256").update(raw).digest("hex"),
      }), cache: "no-store", signal: AbortSignal.timeout(15_000),
    })
    const result = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || result?.ok !== true) {
      const error = String(result?.error || "WEBHOOK_RECONCILIATION_FAILED")
      return reply({ ok: false, error, retryable: true }, error === "TRANSFER_BINDING_MISMATCH" ? 409 : 503)
    }
    return reply({ ok: true, duplicate: Boolean(result.duplicate), status: result.status, paid: result.paid === true })
  } catch { return reply({ ok: false, error: "WEBHOOK_RECONCILIATION_UNAVAILABLE", retryable: true }, 503) }
}
