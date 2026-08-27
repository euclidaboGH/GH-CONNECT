/**
 * Versioned GHC receive QR / deep-link payload.
 * NEVER encodes amount, tokens, balances, or secrets.
 * Format: ghc://receive?v=1&id=GH-XXXXXX
 */

import {
  GH_ID_REGEX,
  normalizeGreenHavenId,
  isValidGreenHavenIdFormat,
} from "./greenhaven-id"

export const GHC_RECEIVE_PROTOCOL = "ghc"
export const GHC_RECEIVE_HOST = "receive"
export const GHC_RECEIVE_VERSION = 1

export type GhcReceivePayload = {
  version: number
  greenHavenId: string
}

export function buildReceivePayload(greenHavenId: string): string {
  const id = normalizeGreenHavenId(greenHavenId)
  if (!GH_ID_REGEX.test(id)) {
    throw new Error("Invalid GreenHaven ID for receive payload")
  }
  return `${GHC_RECEIVE_PROTOCOL}://${GHC_RECEIVE_HOST}?v=${GHC_RECEIVE_VERSION}&id=${encodeURIComponent(id)}`
}

export type ParseReceiveResult =
  | { ok: true; payload: GhcReceivePayload }
  | { ok: false; code: "INVALID_QR" | "UNSUPPORTED_VERSION" | "INVALID_ID"; message: string }

/**
 * Parse and validate untrusted QR / pasted receive content.
 * Rejects arbitrary http(s) execution payloads and unknown schemes.
 */
export function parseReceivePayload(raw: string): ParseReceiveResult {
  const text = String(raw || "").trim()
  if (!text) {
    return { ok: false, code: "INVALID_QR", message: "Empty QR content" }
  }

  // Allow bare GreenHaven ID as soft input (manual / copy)
  if (isValidGreenHavenIdFormat(text) || isValidGreenHavenIdFormat(text.replace(/^@/, ""))) {
    return {
      ok: true,
      payload: {
        version: GHC_RECEIVE_VERSION,
        greenHavenId: normalizeGreenHavenId(text),
      },
    }
  }

  // Reject obvious external URLs (do not open)
  if (/^https?:\/\//i.test(text) || /^javascript:/i.test(text) || /^data:/i.test(text)) {
    return { ok: false, code: "INVALID_QR", message: "Unsupported QR content" }
  }

  let url: URL
  try {
    url = new URL(text)
  } catch {
    return { ok: false, code: "INVALID_QR", message: "Invalid receive code" }
  }

  if (url.protocol !== `${GHC_RECEIVE_PROTOCOL}:`) {
    return { ok: false, code: "INVALID_QR", message: "Not a GreenHaven receive code" }
  }

  // ghc://receive?v=1&id=...
  const host = (url.hostname || url.host || "").toLowerCase()
  const path = (url.pathname || "").replace(/^\//, "").toLowerCase()
  if (host !== GHC_RECEIVE_HOST && path !== GHC_RECEIVE_HOST) {
    // Some parsers put "receive" in pathname for ghc://receive
    if (host !== GHC_RECEIVE_HOST && !path.includes(GHC_RECEIVE_HOST)) {
      return { ok: false, code: "INVALID_QR", message: "Not a GreenHaven receive code" }
    }
  }

  const v = Number(url.searchParams.get("v") || "0")
  if (!Number.isFinite(v) || v < 1) {
    return { ok: false, code: "INVALID_QR", message: "Missing payload version" }
  }
  if (v > GHC_RECEIVE_VERSION) {
    return {
      ok: false,
      code: "UNSUPPORTED_VERSION",
      message: "This receive code uses a newer format. Update the app.",
    }
  }

  const idRaw = url.searchParams.get("id") || ""
  const id = normalizeGreenHavenId(idRaw)
  if (!GH_ID_REGEX.test(id)) {
    return { ok: false, code: "INVALID_ID", message: "Invalid GreenHaven ID in code" }
  }

  // Reject unexpected sensitive-looking params
  for (const key of ["token", "access_token", "secret", "amount", "balance", "key"]) {
    if (url.searchParams.has(key)) {
      return { ok: false, code: "INVALID_QR", message: "Receive code contains disallowed fields" }
    }
  }

  return {
    ok: true,
    payload: { version: v, greenHavenId: id },
  }
}

/** Ensure payload string never contains secrets (test helper) */
export function assertPayloadIsSafe(payload: string): boolean {
  const lower = payload.toLowerCase()
  if (lower.includes("bearer")) return false
  if (lower.includes("token=")) return false
  if (lower.includes("amount=")) return false
  if (lower.includes("balance")) return false
  if (!payload.startsWith("ghc://receive")) return false
  return true
}
