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


/** Emit stable, token-free Pi auth diagnostics for field troubleshooting. */
export function reportPiAuthDiagnostic(
  code: string,
  details: { stage?: string; status?: number; sandbox?: boolean; hasPi?: boolean; hasAccessToken?: boolean; errorName?: string; errorShape?: string; reasonClass?: string; reason?: string; inIframe?: boolean } = {},
): void {
  const safeCode = /^[A-Z0-9_]{3,64}$/.test(code) ? code : "PI_AUTH_DIAGNOSTIC_INVALID"
  const safeDetails = {
    stage: details.stage,
    status: Number.isInteger(details.status) ? details.status : undefined,
    sandbox: typeof details.sandbox === "boolean" ? details.sandbox : undefined,
    hasPi: typeof details.hasPi === "boolean" ? details.hasPi : undefined,
    hasAccessToken: typeof details.hasAccessToken === "boolean" ? details.hasAccessToken : undefined,
    errorName: details.errorName && /^[A-Za-z0-9_]{1,48}$/.test(details.errorName) ? details.errorName : undefined,
    errorShape: details.errorShape && /^[a-z_]{1,16}$/.test(details.errorShape) ? details.errorShape : undefined,
    reasonClass: details.reasonClass && /^[A-Z0-9_]{3,32}$/.test(details.reasonClass) ? details.reasonClass : undefined,
    // Bounded (<=80 chars), printable-ASCII, token-redacted reason text only; never a raw error object.
    reason: typeof details.reason === "string" ? details.reason.slice(0, 80) : undefined,
    inIframe: typeof details.inIframe === "boolean" ? details.inIframe : undefined,
  }
  // Never include tokens, usernames, Pi UIDs, cookies, request bodies, or raw errors.
  console.info("[GH_PI_AUTH_DIAGNOSTIC]", { code: safeCode, ...safeDetails })
  recordPiAuthDiagnostic({ t: new Date().toISOString(), code: safeCode, ...safeDetails })
  if (typeof window !== "undefined") {
    try { window.dispatchEvent(new CustomEvent("gh:pi-auth-diagnostic", { detail: { code: safeCode, ...safeDetails } })) } catch { /* diagnostics must never break authentication */ }
  }
}

type PiAuthDiagnosticEntry = Record<string, string | number | boolean | undefined>
const PI_AUTH_HISTORY_KEY = "__GH_PI_AUTH_HISTORY__"
const PI_AUTH_HISTORY_MAX = 30

function recordPiAuthDiagnostic(entry: PiAuthDiagnosticEntry): void {
  if (typeof window === "undefined") return
  try {
    const w = window as unknown as Record<string, unknown>
    const list = Array.isArray(w[PI_AUTH_HISTORY_KEY]) ? (w[PI_AUTH_HISTORY_KEY] as PiAuthDiagnosticEntry[]) : []
    list.push(entry)
    if (list.length > PI_AUTH_HISTORY_MAX) list.splice(0, list.length - PI_AUTH_HISTORY_MAX)
    w[PI_AUTH_HISTORY_KEY] = list
  } catch { /* diagnostics must never break authentication */ }
}

function isWindowFramed(): boolean {
  try { return window.self !== window.top } catch { return true }
}

/** Short, printable, token-redacted reason text from whatever the Pi SDK rejected with. */
export function sanitizePiAuthReason(err: unknown): string | undefined {
  let raw = ""
  if (typeof err === "string") raw = err
  else if (err instanceof Error) raw = err.message
  else if (err && typeof err === "object") {
    const o = err as Record<string, unknown>
    const found = [o.message, o.error, o.reason, o.code].find((v) => typeof v === "string")
    raw = typeof found === "string" ? found : ""
  }
  const cleaned = raw
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/[A-Za-z0-9_\-.+/=]{24,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
  return cleaned || undefined
}

export function classifyPiAuthReason(reason: string | undefined): string {
  if (!reason) return "NO_MESSAGE"
  if (/timed out|timeout/i.test(reason)) return "TIMEOUT"
  if (/cancel|closed|denied|rejected by (the )?user/i.test(reason)) return "USER_CANCELLED"
  if (/scope/i.test(reason)) return "SCOPE_REJECTED"
  if (/sandbox/i.test(reason)) return "SANDBOX_MISMATCH"
  if (/origin|domain|url|whitelist|not registered|not allowed/i.test(reason)) return "ORIGIN_NOT_REGISTERED"
  if (/network|fetch|offline/i.test(reason)) return "NETWORK"
  if (/^authentication failed\.?$/i.test(reason)) return "GENERIC_SDK_REJECTION"
  return "UNCLASSIFIED"
}

/** Token-free, copyable report for field troubleshooting (host, mode, framing, recent diagnostics). */
export function buildPiAuthDiagnosticReport(): string {
  if (typeof window === "undefined") return "Pi auth diagnostics are client-only"
  const snap = getPiRuntimeSnapshot()
  let referrerHost = "none"
  try { referrerHost = document.referrer ? new URL(document.referrer).hostname : "none" } catch { referrerHost = "unparseable" }
  const w = window as unknown as Record<string, unknown>
  const history = Array.isArray(w[PI_AUTH_HISTORY_KEY]) ? (w[PI_AUTH_HISTORY_KEY] as PiAuthDiagnosticEntry[]) : []
  return [
    `GH Pi auth diagnostics ${new Date().toISOString()}`,
    `host=${snap.hostname} mode=${snap.mode} sandbox=${snap.sandbox}`,
    `clientIdConfigured=${snap.clientIdConfigured} hasWindowPi=${snap.hasWindowPi} hasInit=${snap.hasInit} hasAuthenticate=${snap.hasAuthenticate} initialized=${snap.initialized}`,
    `inIframe=${isWindowFramed()} referrerHost=${referrerHost}`,
    ...history.map((e) => JSON.stringify(e)),
  ].join("\n")
}

/**
 * Sandbox (Testnet) SDK mode normally needs the app opened through Pi Develop's
 * Sandbox link, which frames the app inside sandbox.minepi.com. When sandbox mode
 * is active and the app is top-level, tell the operator instead of a bare failure.
 */
export function getPiSandboxLaunchHint(): string | null {
  if (typeof window === "undefined" || !getPiSandbox()) return null
  if (isWindowFramed()) return null
  return "Sandbox mode is on but this page is not running inside Pi's sandbox frame. Open the app from Pi Develop using its Sandbox link; opening the Vercel URL directly can make Pi reject authorization."
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
    if (getWindowPi()) {
      resolve()
      return
    }
    // The root layout loads the official SDK before interactive. If a caller
    // races that load, wait for the existing script rather than injecting a
    // second copy of the Pi SDK into the document.
    if (existing) {
      void waitForPi(timeoutMs, 150).then((ready) => {
        if (ready) resolve()
        else reject(new Error(`Pi SDK script did not expose window.Pi within ${timeoutMs}ms`))
      })
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
    reportPiAuthDiagnostic("PI_SDK_ALREADY_INITIALIZED", { stage: "sdk_init", sandbox: getPiSandbox(), hasPi: true })
    return getPiRuntimeSnapshot()
  }

  if (!initPromise) {
    initPromise = (async () => {
      reportPiAuthDiagnostic("PI_SDK_INIT_START", { stage: "sdk_init", sandbox: getPiSandbox(), hasPi: Boolean(getWindowPi()) })
      if (!getWindowPi()) {
        await loadScriptOnce(
          PI_NETWORK_CONFIG.SDK_URL,
          PI_NETWORK_CONFIG.SCRIPT_LOAD_TIMEOUT_MS || 12000
        )
        await waitForPi(10000, 150)
      }
      const Pi = getWindowPi()
      if (!Pi) {
        throw new Error(
          "Pi SDK (window.Pi) is not available yet. If you are already in Pi Browser, wait a moment and retry; otherwise open the registered app URL from Pi → Develop."
        )
      }
      if (typeof Pi.init !== "function") {
        throw new Error("Official Pi SDK is present but Pi.init is unavailable; refusing to call other Pi SDK methods")
      }
      await (Pi.init as (cfg: { version: string; sandbox: boolean }) => Promise<void> | void)({
        version: "2.0",
        sandbox: getPiSandbox(),
      })
      initialized = true
      reportPiAuthDiagnostic("PI_SDK_INIT_OK", { stage: "sdk_init", sandbox: getPiSandbox(), hasPi: true })
    })().catch((err) => {
      initPromise = null
      initialized = false
      reportPiAuthDiagnostic("PI_SDK_INIT_FAILED", { stage: "sdk_init", sandbox: getPiSandbox(), hasPi: Boolean(getWindowPi()), errorName: err instanceof Error ? err.name : "UnknownError" })
      throw err
    })
  }

  await initPromise
  return getPiRuntimeSnapshot()
}

export type PiAuthenticateResult = {
  uid: string
  username: string | null
  walletAddress: string | null
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
    user?: { uid?: string | number; username?: string; wallet_address?: string; walletAddress?: string }
    wallet_address?: string
    walletAddress?: string
    accessToken?: string
  }>

  const authenticate = Pi.authenticate as PiAuthFn
  reportPiAuthDiagnostic("PI_AUTH_PROMPT_START", { stage: "pi_authenticate", sandbox: getPiSandbox(), hasPi: true })
  let authResult: Awaited<ReturnType<PiAuthFn>>
  // The Pi bridge can leave authenticate() pending indefinitely when its host
  // cannot present/complete the authorization prompt. Bound this wait so the
  // provider's in-flight guard is eventually released and the user can retry.
  // Promise.race does not cancel the SDK call; we deliberately do not start a
  // second attempt automatically or weaken server-side token verification.
  const authTimeoutMs = 25000
  let authTimeout: ReturnType<typeof setTimeout> | undefined
  try {
    const authPromise = authenticate(scopes, (payment: unknown) => {
      void onIncompletePaymentFound(
        payment as {
          identifier?: string
          paymentId?: string
          transaction?: { txid?: string } | null
        }
      )
    })
    authResult = await Promise.race([
      authPromise,
      new Promise<never>((_, reject) => {
        authTimeout = setTimeout(() => {
          reportPiAuthDiagnostic("PI_AUTH_PROMPT_TIMEOUT", {
            stage: "pi_authenticate",
            sandbox: getPiSandbox(),
            hasPi: true,
          })
          reject(new Error("Pi authorization prompt timed out. Return to Pi Browser and tap Retry Pi authentication."))
        }, authTimeoutMs)
      }),
    ])
  } catch (err) {
    const reason = sanitizePiAuthReason(err)
    reportPiAuthDiagnostic("PI_AUTH_PROMPT_REJECTED", {
      stage: "pi_authenticate",
      sandbox: getPiSandbox(),
      errorName: err instanceof Error ? err.name : "UnknownError",
      errorShape: err instanceof Error ? "error" : typeof err === "string" ? "string" : err && typeof err === "object" ? "object" : "other",
      reasonClass: classifyPiAuthReason(reason),
      reason,
      inIframe: isWindowFramed(),
    })
    // The Pi bridge often rejects with a plain string/object. Wrap it so callers
    // keep a meaningful message instead of an empty "Authentication failed".
    throw err instanceof Error ? err : new Error(reason || "Pi rejected the authorization request")
  } finally {
    if (authTimeout !== undefined) clearTimeout(authTimeout)
  }

  const uid = authResult?.user?.uid != null ? String(authResult.user.uid) : ""
  if (!uid) {
    reportPiAuthDiagnostic("PI_AUTH_RESULT_MISSING_UID", { stage: "pi_authenticate", sandbox: getPiSandbox(), hasPi: true, hasAccessToken: Boolean(authResult?.accessToken) })
    throw new Error("Pi authentication did not return a user id")
  }
  if (typeof authResult?.accessToken !== "string" || authResult.accessToken.length < 16) {
    reportPiAuthDiagnostic("PI_AUTH_RESULT_MISSING_TOKEN", { stage: "pi_authenticate", sandbox: getPiSandbox(), hasPi: true, hasAccessToken: false })
    throw new Error("Pi authentication did not return a usable access token")
  }
  reportPiAuthDiagnostic("PI_AUTH_PROMPT_OK", { stage: "pi_authenticate", sandbox: getPiSandbox(), hasPi: true, hasAccessToken: true })

  return {
    uid,
    username: authResult?.user?.username ? String(authResult.user.username) : null,
    walletAddress: (authResult?.user?.wallet_address || authResult?.user?.walletAddress || authResult?.wallet_address || authResult?.walletAddress)
      ? String(authResult?.user?.wallet_address || authResult?.user?.walletAddress || authResult?.wallet_address || authResult?.walletAddress).trim()
      : null,
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
