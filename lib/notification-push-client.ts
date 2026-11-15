"use client"

import type { PushCategoryPreferences } from "@/lib/notification-push-contract"

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value + "=".repeat((4 - value.length % 4) % 4)
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

function getDeviceId(userId: string): string {
  const key = `ghc_push_device:${encodeURIComponent(userId)}`
  try {
    const existing = localStorage.getItem(key)
    if (existing && /^[A-Za-z0-9_-]{20,100}$/.test(existing)) return existing
    const bytes = crypto.getRandomValues(new Uint8Array(24))
    const created = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
    localStorage.setItem(key, created)
    return created
  } catch {
    throw new Error("DEVICE_STORAGE_UNAVAILABLE")
  }
}

/** Call only from an explicit user gesture. Remote delivery remains disabled until the sender is deployed. */
export async function registerRemotePushForCurrentDevice(
  authHeaders: Record<string, string>,
  userId: string,
  categoryPreferences: PushCategoryPreferences,
): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { ok: false, error: "PUSH_UNSUPPORTED" }
  }
  if (Notification.permission !== "granted") return { ok: false, error: "NOTIFICATION_PERMISSION_REQUIRED" }
  const configResponse = await fetch("/api/notifications/push/config", { cache: "no-store" })
  const config = await configResponse.json().catch(() => null)
  if (!configResponse.ok || !config?.publicKey || config?.remoteDeliveryEnabled !== true) {
    return { ok: false, error: "REMOTE_PUSH_NOT_ENABLED" }
  }
  await navigator.serviceWorker.register("/sw.js", { scope: "/" })
  const ready = await navigator.serviceWorker.ready
  const subscription = await ready.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToBytes(String(config.publicKey)).buffer as ArrayBuffer,
  })
  const response = await fetch("/api/notifications/push/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ subscription: subscription.toJSON(), deviceId: getDeviceId(userId), categoryPreferences }),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || result?.ok !== true) {
    await subscription.unsubscribe().catch(() => false)
    return { ok: false, error: result?.error || "PUSH_SUBSCRIPTION_SAVE_FAILED" }
  }
  return { ok: true }
}

export async function revokeRemotePushForCurrentDevice(
  authHeaders: Record<string, string>,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return { ok: false, error: "PUSH_UNSUPPORTED" }
  const registration = await navigator.serviceWorker.getRegistration("/")
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return { ok: true }
  const endpoint = subscription.endpoint
  const response = await fetch("/api/notifications/push/subscriptions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ endpoint, deviceId: getDeviceId(userId) }),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || result?.ok !== true) return { ok: false, error: result?.error || "PUSH_REVOKE_FAILED" }
  await subscription.unsubscribe()
  return { ok: true }
}
