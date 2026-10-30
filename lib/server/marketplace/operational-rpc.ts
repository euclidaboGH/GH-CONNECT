/**
 * Phase 26 — service-role RPC client for operational financial workflows.
 * Never trusts client amounts as authority for balances; only records evidence-backed operations.
 */
import { createHash, timingSafeEqual } from "node:crypto"
import { hasPrivilegedDatabase, readGhcServerEnv } from "@/lib/server/economy/env"

export function evidenceFingerprint(parts: Record<string, unknown>): string {
  const payload = JSON.stringify(parts, Object.keys(parts).sort())
  return createHash("sha256").update(payload).digest("hex")
}

export function assertOperatorKey(headerValue: string | null): boolean {
  const want = Buffer.from(
    process.env.GHC_OPERATOR_RECONCILE_KEY || process.env.GHC_A2U_ADMIN_KEY || "",
    "utf8",
  )
  const got = Buffer.from(String(headerValue || ""), "utf8")
  if (want.length < 32 || got.length !== want.length) return false
  try {
    return timingSafeEqual(want, got)
  } catch {
    return false
  }
}

export async function callOperationalRpc<T extends Record<string, unknown>>(
  name: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  if (!hasPrivilegedDatabase()) return null
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
    const result = (await response.json().catch(() => null)) as T | null
    if (!response.ok || result === null) return null
    return result
  } catch {
    return null
  }
}
