import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { readGhcServerEnv } from "@/lib/server/economy/env"
import { resolvePiSandbox } from "@/lib/pi-env"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noStore = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
}

type StatementResult = {
  ok?: boolean
  featureAvailable?: boolean
  currency?: "PI"
  atomicUnitsPerPi?: number
  calculatedAtomic?: string
  needsReviewAtomic?: string
  withdrawalEnabled?: boolean
  items?: Array<Record<string, unknown>>
  error?: string
}

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
  }

  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return NextResponse.json({
      ok: false,
      featureAvailable: false,
      error: "CASHBACK_SERVICE_UNAVAILABLE",
    }, { status: 503, headers: noStore })
  }

  try {
    const baseUrl = env.supabaseUrl.replace(/\/$/, "")
    const response = await fetch(`${baseUrl}/rest/v1/rpc/gh_pi_cashback_user_statement`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({ p_user_id: auth.userId, p_limit: 12 }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    })

    const payload = await response.json().catch(() => null) as StatementResult | null
    if (!response.ok || !payload || payload.ok !== true || payload.featureAvailable !== true) {
      // Missing migration or unavailable RPC is deliberately not treated as an empty balance.
      return NextResponse.json({
        ok: false,
        featureAvailable: false,
        error: "CASHBACK_STATEMENT_UNAVAILABLE",
      }, { status: 503, headers: noStore })
    }

    const withdrawalConfigured = process.env.PI_A2U_ENABLED === "true" && process.env.PI_A2U_TESTNET_ONLY === "true" && resolvePiSandbox() && process.env.PI_ENV === "production" && Boolean(String(process.env.PI_API_KEY || process.env.PI_SERVER_API_KEY || "").trim()) && /^S[A-Z2-7]{55}$/.test(String(process.env.PI_WALLET_PRIVATE_SEED || "").trim())
    let payouts: Array<{ entitlement_id?: string; amount_atomic?: string | number; status?: string; provider_payment_id?: string | null; txid?: string | null; paid_at?: string | null; created_at?: string }> = []
    let reservedAtomic = 0n
    let payoutReviewAtomic = 0n
    // Preserve read-only cashback statements when the Testnet payout feature is not configured.
    // If operators enable payout flags, missing migration/status RPC must fail closed.
    if (withdrawalConfigured) {
      const payoutStatusResponse = await fetch(`${baseUrl}/rest/v1/rpc/gh_pi_cashback_a2u_user_status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: env.supabaseServiceRoleKey, Authorization: `Bearer ${env.supabaseServiceRoleKey}` },
        body: JSON.stringify({ p_user_id: auth.userId }),
        cache: "no-store", signal: AbortSignal.timeout(8_000),
      })
      const payoutStatus = await payoutStatusResponse.json().catch(() => null) as { ok?: boolean; reservedAtomic?: string; reviewAtomic?: string; items?: Array<{ entitlement_id?: string; amount_atomic?: string | number; status?: string; provider_payment_id?: string | null; txid?: string | null; paid_at?: string | null; created_at?: string }> } | null
      if (!payoutStatusResponse.ok || !payoutStatus?.ok || !Array.isArray(payoutStatus.items)) {
        return NextResponse.json({ ok: false, featureAvailable: false, error: "CASHBACK_PAYOUT_STATUS_UNAVAILABLE" }, { status: 503, headers: noStore })
      }
      payouts = payoutStatus.items
      reservedAtomic = typeof payoutStatus.reservedAtomic === "string" && /^\d{1,38}$/.test(payoutStatus.reservedAtomic) ? BigInt(payoutStatus.reservedAtomic) : 0n
      payoutReviewAtomic = typeof payoutStatus.reviewAtomic === "string" && /^\d{1,38}$/.test(payoutStatus.reviewAtomic) ? BigInt(payoutStatus.reviewAtomic) : 0n
    }

    const calculatedText = typeof payload.calculatedAtomic === "string" && /^\d{1,38}$/.test(payload.calculatedAtomic) ? payload.calculatedAtomic : "0"
    const calculatedAtomic = BigInt(calculatedText) > reservedAtomic ? (BigInt(calculatedText) - reservedAtomic).toString() : "0"
    const withdrawalEnabled = withdrawalConfigured
    const payoutsByEntitlement = new Map(payouts.map((p) => [String(p.entitlement_id || ""), p]))
    const items = (Array.isArray(payload.items) ? payload.items.slice(0, 12) : []).map((item) => {
      const payout = payoutsByEntitlement.get(String(item.entitlement_id || ""))
      return payout ? { ...item, financial_state: payout.status === "paid" ? "paid" : payout.status === "attention" ? "needs_review" : "payout_processing", payout_txid: payout.txid || null, payout_created_at: payout.created_at || null } : item
    })

    return NextResponse.json({
      ok: true,
      featureAvailable: true,
      currency: "PI",
      atomicUnitsPerPi: 10_000_000,
      calculatedAtomic,
      needsReviewAtomic: (() => {
        const base = typeof payload.needsReviewAtomic === "string" && /^\d{1,38}$/.test(payload.needsReviewAtomic) ? BigInt(payload.needsReviewAtomic) : 0n
        return (base + payoutReviewAtomic).toString()
      })(),
      withdrawalEnabled,
      items,
      authority: "server_cashback_ledger",
    }, { headers: noStore })
  } catch {
    return NextResponse.json({
      ok: false,
      featureAvailable: false,
      error: "CASHBACK_STATEMENT_UNAVAILABLE",
    }, { status: 503, headers: noStore })
  }
}
