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
export function allowMemoryServer(): boolean {
  if (isDatabaseConfigured()) return false
  return process.env.GHC_SERVER_MEMORY === "1" || process.env.NODE_ENV === "test"
}
