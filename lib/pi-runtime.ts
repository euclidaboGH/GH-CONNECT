/**
 * GreenHaven — authoritative Pi client runtime (single source of truth).
 *
 * Responsibilities:
 * - sandbox vs mainnet resolution (Preview/dev → sandbox, Production → mainnet)
 * - one-shot SDK script load + Pi.init
 * - shared accessors for window.Pi
 * - official authenticate wrapper (caller must still verify token on server)
 *
 * Never exposes PI_API_KEY, wallet seeds, or server secrets.
 * Never treats client uid as final identity — server /api/auth/pi is required.
 */

import { getPiClientId, resolvePiSandbox } from "@/lib/pi-env"
import { PI_NETWORK_CONFIG } from "@/lib/system-config"
import { onIncompletePaymentFound } from "@/lib/pi-incomplete-payment"

export type PiNetworkMode = "sandbox" | "mainnet"

export type PiRuntimeSnapshot = {
  mode: PiNetworkMode
  sandbox: boolean
  clientIdConfigured: boolean
  hasWindowPi: boolean
  hasInit: boolean
  hasAuthenticate: boolean
  hasCreatePayment: boolean
  initialized: boolean
  hostname: string | null
}

let initPromise: Promise<void> | null = null
let initialized = false

function getWindowPi(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null
  const Pi = (window as unknown as { Pi?: Record<string, unknown> }).Pi
  return Pi && typeof Pi === "object" ? Pi : null
}

/** Single sandbox resolution — use everywhere (payments, auth, probes). */
export function getPiSandbox(hostname?: string | null): boolean {
  const host =
    hostname ??
    (typeof window !== "undefined" ? window.location.hostname : null)
  return resolvePiSandbox({ hostname: host })
}

export function getPiNetworkMode(hostname?: string | null): PiNetworkMode {
  return getPiSandbox(hostname) ? "sandbox" : "mainnet"
}

export function getPiRuntimeSnapshot(): PiRuntimeSnapshot {
  const Pi = getWindowPi()
  const host =
    typeof window !== "undefined" ? window.location.hostname : null
  const sandbox = getPiSandbox(host)
  return {
    mode: sandbox ? "sandbox" : "mainnet",
    sandbox,
    clientIdConfigured: Boolean(getPiClientId()),
    hasWindowPi: Boolean(Pi),
    hasInit: typeof Pi?.init === "function",
    hasAuthenticate: typeof Pi?.authenticate === "function",
    hasCreatePayment: typeof Pi?.createPayment === "function",
    initialized,
    hostname: host,
  }
}

function loadScriptOnce(src: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("No document"))
      return
    }
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing && getWindowPi()) {
      resolve()
      return
    }
    const script = document.createElement("script")
    script.src = src
    script.async = true
    const t = window.setTimeout(() => {
      script.remove()
      reject(new Error(`Pi SDK script timeout (${timeoutMs}ms)`))
    }, timeoutMs)
    script.onload = () => {
      window.clearTimeout(t)
      resolve()
    }
    script.onerror = () => {
      window.clearTimeout(t)
      reject(new Error("Pi SDK script failed to load"))
    }
    document.head.appendChild(script)
  })
}

async function waitForPi(ms: number, step: number): Promise<boolean> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (getWindowPi()) return true
    await new Promise((r) => setTimeout(r, step))
  }
  return Boolean(getWindowPi())
}

/**
 * Load pi-sdk.js if needed and call Pi.init once.
 * Concurrent callers share the same promise.
 */
export async function ensurePiInitialized(): Promise<PiRuntimeSnapshot> {
  if (typeof window === "undefined") {
    throw new Error("Pi runtime is client-only")
  }

  if (initialized && getWindowPi()) {
    return getPiRuntimeSnapshot()
  }

  if (!initPromise) {
    initPromise = (async () => {
      if (!getWindowPi()) {
        await loadScriptOnce(
          PI_NETWORK_CONFIG.SDK_URL,
          PI_NETWORK_CONFIG.SCRIPT_LOAD_TIMEOUT_MS || 12000
        )
        await waitForPi(5000, 150)
      }
      const Pi = getWindowPi()
      if (!Pi) {
        throw new Error(
          "Pi SDK (window.Pi) is not available. Open GreenHaven inside Pi Browser with the registered app URL."
        )
      }
      if (typeof Pi.init === "function") {
        await (Pi.init as (cfg: { version: string; sandbox: boolean }) => Promise<void> | void)({
          version: "2.0",
          sandbox: getPiSandbox(),
        })
      }
      initialized = true
    })().catch((err) => {
      initPromise = null
      initialized = false
      throw err
    })
  }

  await initPromise
  return getPiRuntimeSnapshot()
}

export type PiAuthenticateResult = {
  uid: string
  username: string | null
  accessToken: string | null
}

/**
 * Official client auth. Does NOT establish GreenHaven session —
 * caller must POST accessToken to /api/auth/pi for verification.
 */
export async function piAuthenticateOfficial(
  scopes: string[] = ["username", "payments"]
): Promise<PiAuthenticateResult> {
  await ensurePiInitialized()
  const Pi = getWindowPi()
  if (!Pi || typeof Pi.authenticate !== "function") {
    throw new Error("Pi.authenticate is not available on this host")
  }

  type PiAuthFn = (
    scopes: string[],
    onIncomplete: (payment: unknown) => void
  ) => Promise<{
    user?: { uid?: string | number; username?: string }
    accessToken?: string
  }>

  const authenticate = Pi.authenticate as PiAuthFn
  const authResult = await authenticate(scopes, (payment: unknown) => {
    void onIncompletePaymentFound(
      payment as {
        identifier?: string
        paymentId?: string
        transaction?: { txid?: string } | null
      }
    )
  })

  const uid = authResult?.user?.uid != null ? String(authResult.user.uid) : ""
  if (!uid) {
    throw new Error("Pi authentication did not return a user id")
  }

  return {
    uid,
    username: authResult?.user?.username ? String(authResult.user.username) : null,
    accessToken: authResult?.accessToken ? String(authResult.accessToken) : null,
  }
}

/** True when createPayment is available (after init in Pi Browser). */
export function isPiCreatePaymentReady(): boolean {
  const Pi = getWindowPi()
  return typeof Pi?.createPayment === "function"
}

export function getPiGlobal(): Record<string, unknown> | null {
  return getWindowPi()
}
