/**
 * Local Pi/SDKLite stand-in for App Studio preview and offline development
 * when the remote SDKLite script cannot load.
 *
 * Provides enough of SDKLiteInstance for GH Connect to authenticate and
 * persist profile/posts via localStorage-backed state.
 */

import type { SDKLiteInstance, Product, UserPurchaseBalance } from "./sdklite-types"

const PREFIX = "ghc_pi_state:"

function readBlob(key: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function writeBlob(key: string, blob: Record<string, unknown>) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(blob ?? {}))
  } catch {
    /* quota */
  }
}

export function createLocalSdkLite(userId = "current-user"): SDKLiteInstance {
  const products: Product[] = []
  const purchases: UserPurchaseBalance[] = []

  const instance = {
    login: async () => true,
    makePurchase: async () => {
      throw Object.assign(new Error("Purchases unavailable in local preview"), {
        name: "SDKLiteError",
        code: "purchase_error" as const,
      })
    },
    isAdNetworkSupported: async () => false,
    showInterstitial: async () => false,
    showRewarded: async () => false,
    state: {
      get: async (key: string) => {
        const blob = readBlob(key)
        if (!blob) return null
        return {
          blob,
          updatedAt: new Date().toISOString(),
          version: 1,
        }
      },
      set: async (key: string, blob: Record<string, unknown>) => {
        writeBlob(key, blob)
      },
      products: async () => ({ products }),
      purchases: async () => ({ purchases }),
      consume: async () => ({ ok: true as const }),
      restore: async () => ({ purchases }),
    },
  }

  return instance as unknown as SDKLiteInstance
}

export function isLikelyAppStudioPreview(): boolean {
  if (typeof window === "undefined") return false
  try {
    if (window.self !== window.top) return true
  } catch {
    return true
  }
  const host = window.location.hostname || ""
  return (
    host.includes("appstudio") ||
    host.includes("piappengine") ||
    host.includes("localhost") ||
    host.includes("127.0.0.1")
  )
}
