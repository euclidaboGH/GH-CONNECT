import { readGhcServerEnv } from "@/lib/server/economy/env"
import { hasPushSubscriptionEncryptionKey, validateVapidConfiguration } from "@/lib/server/notifications/push-secrets"
import { supabaseRpc, supabaseRest } from "@/lib/server/supabase/rest-client"

export { hashPushEndpoint, normalizePushCategoryPreferences, normalizePushDeviceId, normalizePushEndpoint, validatePushSubscription } from "@/lib/notification-push-contract"

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

export async function notificationPushRpc(name: string, body: Record<string, unknown>) {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false as const, data: null, error: "DB_UNAVAILABLE" }
  const result = await supabaseRpc<unknown>(name, body, { timeoutMs: 15_000 })
  if (!result.ok) return { ok: false as const, data: result.body ?? null, error: result.error }
  const data = result.data
  const envelope = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null
  return {
    ok: envelope?.ok !== false,
    data,
    error: typeof envelope?.error === "string" ? envelope.error : undefined,
  }
}
