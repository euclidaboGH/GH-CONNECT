import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkRateLimit } from "@/lib/server/economy/rate-limit"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import {
  getWebPushConfiguration, hashPushEndpoint, normalizePushCategoryPreferences,
  normalizePushDeviceId, normalizePushEndpoint, notificationPushRpc, validatePushSubscription,
} from "@/lib/server/notifications/push-architecture"
import { encryptPushSecret } from "@/lib/server/notifications/push-secrets"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const noStore = { "Cache-Control": "no-store" }

export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
  const rl = checkRateLimit(`notification-push-status:${auth.userId}`, 30, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: noStore })
  const result = await notificationPushRpc("gh_notification_push_subscription_list", { p_user_id: auth.userId })
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error || "PUSH_STORE_UNAVAILABLE", activeDevices: [] }, { status: 503, headers: noStore })
  return NextResponse.json({ ok: true, durable: true, activeDevices: Array.isArray(result.data?.subscriptions) ? result.data.subscriptions : [], remoteDeliveryEnabled: false }, { headers: noStore })
}

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
  const rl = checkRateLimit(`notification-push-register:${auth.userId}`, 10, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { ...noStore, "Retry-After": String(rl.retryAfterSec) } })
  const config = getWebPushConfiguration()
  if (!config.senderImplemented) return NextResponse.json({ ok: false, error: "REMOTE_PUSH_NOT_ENABLED" }, { status: 503, headers: noStore })
  if (!config.databaseConfigured) return NextResponse.json({ ok: false, error: "PUSH_DATABASE_UNAVAILABLE" }, { status: 503, headers: noStore })
  if (!config.publicKeyConfigured) return NextResponse.json({ ok: false, error: config.vapidConfigurationError || "PUSH_VAPID_CONFIGURATION_INVALID" }, { status: 503, headers: noStore })
  if (!config.encryptionConfigured) return NextResponse.json({ ok: false, error: "PUSH_SUBSCRIPTION_ENCRYPTION_KEY_NOT_CONFIGURED" }, { status: 503, headers: noStore })
  const parsed = await readBoundedJson(request, 12 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: noStore })
  const input = parsed.value as Record<string, unknown>
  const subscription = validatePushSubscription(input.subscription)
  const deviceId = normalizePushDeviceId(input.deviceId)
  const categoryPreferences = normalizePushCategoryPreferences(input.categoryPreferences)
  if (!subscription || !deviceId || !categoryPreferences) return NextResponse.json({ ok: false, error: "INVALID_SUBSCRIPTION" }, { status: 400, headers: noStore })
  const endpointHash = hashPushEndpoint(subscription.endpoint)
  const result = await notificationPushRpc("gh_notification_push_subscription_upsert", {
    p_user_id: auth.userId,
    p_device_id: deviceId,
    p_endpoint_hash: endpointHash,
    p_endpoint_ciphertext: encryptPushSecret(subscription.endpoint),
    p_p256dh_ciphertext: encryptPushSecret(subscription.p256dh),
    p_auth_ciphertext: encryptPushSecret(subscription.auth),
    p_expiration_time: subscription.expirationTime ? new Date(subscription.expirationTime).toISOString() : null,
    p_category_preferences: categoryPreferences,
  })
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error || "PUSH_SUBSCRIPTION_SAVE_FAILED" }, { status: 503, headers: noStore })
  return NextResponse.json({ ok: true, durable: true, subscriptionId: result.data?.subscriptionId ?? null, remoteDeliveryEnabled: false, message: "Subscription registered; remote sender is not yet enabled." }, { headers: noStore })
}

export async function DELETE(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401, headers: noStore })
  const rl = checkRateLimit(`notification-push-revoke:${auth.userId}`, 20, 60_000)
  if (!rl.ok) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: noStore })
  const parsed = await readBoundedJson(request, 4 * 1024)
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400, headers: noStore })
  const input = parsed.value as Record<string, unknown>
  const endpoint = normalizePushEndpoint(input.endpoint)
  const endpointHash = endpoint ? hashPushEndpoint(endpoint) : ""
  if (!endpointHash) return NextResponse.json({ ok: false, error: "INVALID_ENDPOINT" }, { status: 400, headers: noStore })
  const result = await notificationPushRpc("gh_notification_push_subscription_revoke", {
    p_user_id: auth.userId, p_endpoint_hash: endpointHash,
  })
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error || "PUSH_REVOKE_FAILED" }, { status: 503, headers: noStore })
  return NextResponse.json({ ok: true, durable: true, revoked: Number(result.data?.revoked ?? 0) > 0 }, { headers: noStore })
}
