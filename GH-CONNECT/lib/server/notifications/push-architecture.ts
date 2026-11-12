import { readGhcServerEnv } from "@/lib/server/economy/env"
import { hasPushSubscriptionEncryptionKey, validateVapidConfiguration } from "@/lib/server/notifications/push-secrets"

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
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false, data: null as any, error: "DB_UNAVAILABLE" }
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
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) return { ok: false, data, error: `HTTP_${response.status}` }
    return { ok: data?.ok !== false, data, error: data?.error ? String(data.error) : undefined }
  } catch { return { ok: false, data: null as any, error: "RPC_FAILED" } }
}
