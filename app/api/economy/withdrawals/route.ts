/**
 * GET  /api/economy/withdrawals — quote + list for session user
 * POST /api/economy/withdrawals — create withdrawal REQUEST (no Pi send)
 */
import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { rpcWalletSnapshot } from "@/lib/server/economy/db"
import {
  createWithdrawalRequest,
  fetchLockedGhc,
  getWithdrawalQuote,
  listWithdrawalsForUser,
  minGhcForWithdrawal,
  getApprovedGhcPerPi,
  areGhcPiWithdrawalsEnabled,
} from "@/lib/server/economy/withdrawal"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  if (!areGhcPiWithdrawalsEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error: "GHC_WITHDRAWALS_DISABLED",
        message: "GHC-to-Pi settlement is not available. GHC remains an in-app utility balance unless a separately governed settlement product is approved.",
      },
      { status: 503 }
    )
  }
  const snap = await rpcWalletSnapshot(auth.userId).catch(() => null)
  const balanceRaw = (snap as { balance?: number } | null)?.balance
  const balance = Number(balanceRaw)
  if (!snap || !Number.isFinite(balance) || balance < 0) {
    return NextResponse.json(
      { ok: false, error: "WALLET_SNAPSHOT_UNAVAILABLE", message: "Withdrawal eligibility cannot be calculated safely right now." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
  const locked = await fetchLockedGhc(auth.userId)
  if (locked === null) {
    return NextResponse.json(
      { ok: false, error: "WITHDRAWAL_LOCKS_UNAVAILABLE", message: "Withdrawal eligibility cannot be calculated until locked balances are available." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
  const quote = await getWithdrawalQuote(balance, locked)
  const items = await listWithdrawalsForUser(auth.userId)
  if (items === null) {
    return NextResponse.json(
      { ok: false, error: "WITHDRAWAL_HISTORY_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
  return NextResponse.json({ ok: true, quote, withdrawals: items }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) {
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 })
  }
  if (!areGhcPiWithdrawalsEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error: "GHC_WITHDRAWALS_DISABLED",
        message: "GHC-to-Pi settlement is not available. GHC remains an in-app utility balance unless a separately governed settlement product is approved.",
      },
      { status: 503 }
    )
  }
  const body = await request.json().catch(() => ({}))
  const ghcAmount = Number(body.ghcAmount)
  const piWalletAddress = String(body.piWalletAddress || body.walletAddress || "").trim()
  // Require stable client key — Date.now() fallback would allow accidental duplicate requests
  const idempotencyKey = String(body.idempotencyKey || body.clientRequestId || "").trim()
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    return NextResponse.json(
      {
        ok: false,
        error: "IDEMPOTENCY_KEY_REQUIRED",
        message: "idempotencyKey (8–128 chars) is required to prevent duplicate withdrawal requests",
      },
      { status: 400 }
    )
  }

  if (!Number.isFinite(ghcAmount) || ghcAmount <= 0) {
    return NextResponse.json({ ok: false, error: "INVALID_AMOUNT" }, { status: 400 })
  }
  // Server recalculates rate — ignore client rate/piAmount
  const rate = getApprovedGhcPerPi()
  const minGhc = minGhcForWithdrawal(rate)
  if (ghcAmount + 1e-9 < minGhc) {
    return NextResponse.json(
      {
        ok: false,
        error: "BELOW_MINIMUM",
        minGhc,
        minPi: 100,
        ghcPerPi: rate,
        message: `Minimum withdrawal is 100 π equivalent (${minGhc} GHC at ${rate} GHC/π).`,
      },
      { status: 400 }
    )
  }

  const result = await createWithdrawalRequest({
    userId: auth.userId,
    ghcAmount,
    piWalletAddress,
    idempotencyKey,
  })
  if (!result.ok || !result.request) {
    const status =
      result.error === "INSUFFICIENT_WITHDRAWABLE"
        ? 400
        : result.error === "INVALID_WALLET"
          ? 400
          : 503
    return NextResponse.json({ ok: false, error: result.error || "CREATE_FAILED" }, { status })
  }
  return NextResponse.json({
    ok: true,
    duplicate: Boolean(result.duplicate),
    request: result.request,
    message:
      "Withdrawal request created. Pi is not sent instantly — GreenHaven will process settlement.",
  })
}
