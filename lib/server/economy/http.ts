import { NextResponse } from "next/server"
import type { GhcTransferErrorCode } from "@/lib/domains/economy-transfer-contract"
import { hasPrivilegedDatabase, readGhcServerEnv } from "./env"

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export function jsonErr(
  code: GhcTransferErrorCode | string,
  message: string,
  status = 400
) {
  return NextResponse.json({ ok: false, code, message, error: message }, { status })
}

export function isDatabaseConfigured(): boolean {
  return hasPrivilegedDatabase(readGhcServerEnv())
}

/**
 * In-process GHC ledger is STRICTLY local development / unit tests only.
 *
 * NEVER active when:
 * - Supabase/Postgres is configured (DB is sole authority)
 * - Running on Vercel (any VERCEL_ENV)
 * - NODE_ENV === "production"
 * - GHC_ENV === "production"
 *
 * GHC_ALLOW_MEMORY_IN_PRODUCTION is intentionally ignored — balances must not
 * live in serverless process memory across instances.
 */
export function allowMemoryServer(): boolean {
  if (isDatabaseConfigured()) return false

  // Any Vercel deployment (production, preview, development on Vercel)
  if (process.env.VERCEL === "1" || process.env.VERCEL_ENV) {
    return false
  }
  if (
    process.env.NODE_ENV === "production" ||
    process.env.GHC_ENV === "production"
  ) {
    return false
  }
  if (process.env.NODE_ENV === "test") return true
  if (process.env.NODE_ENV === "development") return true
  // Explicit local opt-in only outside production/Vercel
  if (process.env.GHC_SERVER_MEMORY === "1") return true
  return false
}

/** True when this runtime forbids memory-mode financial authority */
export function isProductionMemoryFinancialBlocked(): boolean {
  if (isDatabaseConfigured()) return false
  if (process.env.VERCEL === "1" || process.env.VERCEL_ENV) return true
  if (
    process.env.NODE_ENV === "production" ||
    process.env.GHC_ENV === "production"
  ) {
    return true
  }
  return false
}

/** Standard configuration error when durable economy is unavailable */
export const DURABLE_ECONOMY_CONFIG_ERROR =
  "GHC durable ledger requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY with economy migrations applied. In-memory balances are not available on this deployment."

/**
 * Guard for money-moving and balance-reading routes.
 * Prefer DB; allow memory only in local/dev/test; otherwise 503-ready error payload.
 */
export function durableEconomyGate():
  | { ok: true; mode: "database" | "memory" }
  | { ok: false; code: string; message: string } {
  if (isDatabaseConfigured()) return { ok: true, mode: "database" }
  if (allowMemoryServer()) return { ok: true, mode: "memory" }
  return {
    ok: false,
    code: "SERVER_UNAVAILABLE",
    message: DURABLE_ECONOMY_CONFIG_ERROR,
  }
}
