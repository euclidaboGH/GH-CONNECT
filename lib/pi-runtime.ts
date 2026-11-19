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
  origin: string | null
  referrerHost: string
  inIframe: boolean
  sandboxFrame: boolean
}


/** Emit stable, token-free Pi auth diagnostics for field troubleshooting. */
export function reportPiAuthDiagnostic(
  code: string,
  details: { stage?: string; status?: number; sandbox?: boolean; hasPi?: boolean; hasAccessToken?: boolean; errorName?: string; errorShape?: string; reasonClass?: string; reason?: string; sdkErrorCode?: string; sdkErrorStatus?: number; sdkErrorFields?: string; inIframe?: boolean; userActivationActive?: boolean } = {},
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
    sdkErrorCode: details.sdkErrorCode && /^[A-Z][A-Z0-9_:-]{1,47}$/.test(details.sdkErrorCode) ? details.sdkErrorCode : undefined,
    sdkErrorStatus: Number.isInteger(details.sdkErrorStatus) && details.sdkErrorStatus! >= 100 && details.sdkErrorStatus! <= 599 ? details.sdkErrorStatus : undefined,
    sdkErrorFields: typeof details.sdkErrorFields === "string" ? details.sdkErrorFields.slice(0, 120) : undefined,
    inIframe: typeof details.inIframe === "boolean" ? details.inIframe : undefined,
    userActivationActive: typeof details.userActivationActive === "boolean" ? details.userActivationActive : undefined,
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

function getReferrerHost(): string {
  if (typeof document === "undefined" || !document.referrer) return "none"
  try { return new URL(document.referrer).hostname.toLowerCase() } catch { return "unparseable" }
}

export function isPiSandboxFrame(): boolean {
  if (typeof window === "undefined" || !getPiSandbox()) return false
  let framed = false
  try { framed = window.self !== window.top } catch { framed = true }
  const referrerHost = getReferrerHost()
  // Pi's Developer Sandbox can embed the registered app through either its
  // sandbox host or the Pi app CDN wrapper. The reported Pi Browser frame uses
  // app-cdn.minepi.com; excluding it sends sign-in through the legacy parent
  // credential probe, which awaits postMessage and loses the original tap's
  // transient user activation before Pi.authenticate is invoked.
  // Framing and Testnet mode are still mandatory; a copied referrer alone is
  // never enough to classify a top-level page as a trusted Sandbox frame.
  const trustedSandboxReferrer =
    referrerHost === "sandbox.minepi.com" ||
    referrerHost.endsWith(".sandbox.minepi.com") ||
    referrerHost === "app-cdn.minepi.com"
  return framed && trustedSandboxReferrer
}

function isWindowFramed(): boolean {
  try { return window.self !== window.top } catch { return true }
}

function isUserActivationActive(): boolean | undefined {
  try {
    const activation = (navigator as Navigator & { userActivation?: { isActive?: boolean } }).userActivation
    return typeof activation?.isActive === "boolean" ? activation.isActive : undefined
  } catch { return undefined }
}

/** Short, printable, token-redacted reason text from whatever the Pi SDK rejected with. */
export function sanitizePiAuthReason(err: unknown): string | undefined {
  let candidates: unknown[] = []
  if (typeof err === "string") candidates = [err]
  else if (err && typeof err === "object") {
    const o = err as Record<string, unknown>
    // Prefer machine-readable rejection details over a generic Error.message.
    candidates = [o.code, o.errorCode, o.reason, o.error, o.message]
    for (const nestedKey of ["data", "response", "cause"]) {
      const nested = o[nestedKey]
      if (nested && typeof nested === "object") {
        const n = nested as Record<string, unknown>
        candidates.push(n.code, n.errorCode, n.reason, n.error, n.message)
      }
    }
  }
  const raw = candidates.find((v) => typeof v === "string" && v.trim())
  if (typeof raw !== "string") return undefined
  const cleaned = raw
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/[A-Za-z0-9_\-.+/=]{24,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
  return cleaned || undefined
}

/** Extract only safe, bounded SDK rejection metadata; never serialize error objects. */
export function getPiAuthErrorMetadata(err: unknown): {
  code?: string
  status?: number
  fields?: string
} {
  if (!err || typeof err !== "object") return {}
  const root = err as Record<string, unknown>
  const allowed = new Set(["name", "message", "code", "errorCode", "reason", "error", "status", "statusCode", "data", "response", "cause"])
  const seen = new Set<string>()
  const collect = (value: unknown, depth: number) => {
    if (!value || typeof value !== "object" || depth > 1) return
    const record = value as Record<string, unknown>
    for (const key of Object.keys(record)) if (allowed.has(key)) seen.add(key)
    if (depth === 0) for (const key of ["data", "response", "cause"]) collect(record[key], depth + 1)
  }
  collect(root, 0)
  const candidates = [root.code, root.errorCode, (root.data as Record<string, unknown> | undefined)?.code, (root.response as Record<string, unknown> | undefined)?.code]
  const rawCode = candidates.find((v) => typeof v === "string" && /^[A-Z][A-Z0-9_:-]{1,47}$/.test(v))
  const statusCandidates = [root.status, root.statusCode, (root.response as Record<string, unknown> | undefined)?.status]
  const status = statusCandidates.find((v) => Number.isInteger(v) && Number(v) >= 100 && Number(v) <= 599)
  return {
    code: typeof rawCode === "string" ? rawCode : undefined,
    status: typeof status === "number" ? status : undefined,
    fields: [...seen].sort().join(",").slice(0, 120) || undefined,
  }
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
  const referrerHost = snap.referrerHost
  const w = window as unknown as Record<string, unknown>
  const history = Array.isArray(w[PI_AUTH_HISTORY_KEY]) ? (w[PI_AUTH_HISTORY_KEY] as PiAuthDiagnosticEntry[]) : []
  return [
    `GH Pi auth diagnostics ${new Date().toISOString()}`,
    `host=${snap.hostname} origin=${snap.origin || "none"} mode=${snap.mode} sandbox=${snap.sandbox}`,
    `clientIdConfigured=${snap.clientIdConfigured} hasWindowPi=${snap.hasWindowPi} hasInit=${snap.hasInit} hasAuthenticate=${snap.hasAuthenticate} initialized=${snap.initialized}`,
    `inIframe=${snap.inIframe} referrerHost=${referrerHost} sandboxFrame=${snap.sandboxFrame}`,
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
  // Use the same frame/referrer evidence as diagnostics and the auth bootstrap.
  // Never show the direct-URL warning when the Pi Sandbox wrapper is confirmed.
  if (isPiSandboxFrame() || isWindowFramed()) return null
  return "Sandbox mode is enabled, but this page is not inside a recognised Pi Sandbox frame. Open the app with its Sandbox launch link."
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
    origin: typeof window !== "undefined" ? window.location.origin : null,
    referrerHost: getReferrerHost(),
    inIframe: typeof window !== "undefined" ? isWindowFramed() : false,
    sandboxFrame: isPiSandboxFrame(),
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
  // Important: when the SDK was pre-initialized during page bootstrap, invoke
  // Pi.authenticate immediately in the click handler's task. Do not insert an
  // awaited init/bridge step between the user's tap and the Pi authorization
  // prompt. If not ready, initialize first; the caller can then retry by tap.
  if (!initialized || !getWindowPi()) {
    return ensurePiInitialized().then(() => piAuthenticateOfficial(scopes))
  }
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
  reportPiAuthDiagnostic("PI_AUTH_INVOKE_CONTEXT", {
    stage: "pi_authenticate",
    sandbox: getPiSandbox(),
    hasPi: true,
    inIframe: isWindowFramed(),
    userActivationActive: isUserActivationActive(),
  })
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
    const metadata = getPiAuthErrorMetadata(err)
    reportPiAuthDiagnostic("PI_AUTH_PROMPT_REJECTED", {
      stage: "pi_authenticate",
      sandbox: getPiSandbox(),
      errorName: err instanceof Error ? err.name : "UnknownError",
      errorShape: err instanceof Error ? "error" : typeof err === "string" ? "string" : err && typeof err === "object" ? "object" : "other",
      reasonClass: classifyPiAuthReason(reason),
      reason,
      sdkErrorCode: metadata.code,
      sdkErrorStatus: metadata.status,
      sdkErrorFields: metadata.fields,
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
