import { readGhcServerEnv } from "@/lib/server/economy/env"
import { hashPushEndpoint } from "@/lib/server/notifications/push-hash"
import { hasPushSubscriptionEncryptionKey, validateVapidConfiguration } from "@/lib/server/notifications/push-secrets"
import { supabaseRpc, supabaseRest } from "@/lib/server/supabase/rest-client"

export { hashPushEndpoint }
export { normalizePushCategoryPreferences, normalizePushDeviceId, normalizePushEndpoint, validatePushSubscription } from "@/lib/notification-push-contract"

export function getWebPushConfiguration() {
  const env = readGhcServerEnv()
  const vapid = validateVapidConfiguration(
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY || "",
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY || "",
    process.env.WEB_PUSH_VAPID_SUBJECT || "",
  )
  const encryptionConfigured = hasPushSubscriptionEncryptionKey()
  return {
    protocol: "web_push_vapid" as const,
    provider: "standards_based_web_push" as const,
    publicKeyConfigured: vapid.valid,
    vapidConfigurationValid: vapid.valid,
    vapidConfigurationError: vapid.reason,
    encryptionConfigured,
    databaseConfigured: Boolean(env.supabaseUrl && env.supabaseServiceRoleKey),
    senderImplemented: false as const,
    ready: false as const,
    publicKey: vapid.valid ? vapid.publicKey : null,
  }
}

function isRpcRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export async function notificationPushRpc(name: string, body: Record<string, unknown>) {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return { ok: false as const, data: null, error: "DB_UNAVAILABLE" }
  }
  const result = await supabaseRpc<unknown>(name, body, { timeoutMs: 15_000 })
  if (!result.ok) {
    return { ok: false as const, data: null, error: result.error || "PUSH_STORE_UNAVAILABLE" }
  }
  if (!isRpcRecord(result.data)) {
    return { ok: false as const, data: null, error: "INVALID_PUSH_RPC_RESPONSE" }
  }
  const data = result.data
  if (data.ok !== true) {
    return {
      ok: false as const,
      data,
      error: typeof data.error === "string" ? data.error : "PUSH_RPC_REJECTED",
    }
  }
  return {
    ok: true as const,
    data,
    error: typeof data.error === "string" ? data.error : undefined,
  }
}
