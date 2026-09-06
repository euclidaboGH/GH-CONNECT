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
 * Process memory store only for explicit Studio/test — never when DB is configured,
 * and never as a silent fallback after DB failure.
 */
/**
 * In-process authoritative ledger when no privileged database is configured.
 * Enable with GHC_SERVER_MEMORY=1 (required on Vercel/production without Supabase).
 * Development enables memory automatically when DB is absent so local spend/claim work.
 * Never used when a real DB is configured — DB is always preferred.
 */
export function allowMemoryServer(): boolean {
  // Database always wins when configured — never dual-authority.
  if (isDatabaseConfigured()) return false
  // Production: memory financial mode is forbidden unless explicitly emergency-armed.
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    if (process.env.GHC_SERVER_MEMORY === "1") {
      if (process.env.GHC_ALLOW_MEMORY_IN_PRODUCTION === "1") {
        return true
      }
      // Fail closed: do not treat memory as authority in production.
      return false
    }
    return false
  }
  if (process.env.GHC_SERVER_MEMORY === "1") return true
  if (process.env.NODE_ENV === "test") return true
  if (process.env.NODE_ENV === "development") return true
  return false
}

/** True when production would reject memory-mode financial authority */
export function isProductionMemoryFinancialBlocked(): boolean {
  const prod =
    process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production"
  if (!prod) return false
  if (isDatabaseConfigured()) return false
  return process.env.GHC_ALLOW_MEMORY_IN_PRODUCTION !== "1"
}
