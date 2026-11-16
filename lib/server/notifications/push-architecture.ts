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
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false, data: null as any, error: "DB_UNAVAILABLE" }
  try {
    const response = await (async () => { const r = await supabaseRpc('${name}', typeof JSON.stringify(body) === "string" ? JSON.parse(JSON.stringify(body)) : JSON.stringify(body), { timeoutMs: 15000 }); return { ok: r.ok, status: r.status, json: async () => r.ok ? r.data : r.body, text: async () => JSON.stringify(r.ok ? r.data : r.body) }; })()
    const data = await response.json().catch(() => null)
    if (!response.ok) return { ok: false, data, error: `HTTP_${response.status}` }
    return { ok: data?.ok !== false, data, error: data?.error ? String(data.error) : undefined }
  } catch { return { ok: false, data: null as any, error: "RPC_FAILED" } }
}
