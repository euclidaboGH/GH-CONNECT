/**
 * WebAuthn RP configuration for GH CONNECT (Phase 7).
 *
 * Production must set:
 *   WEBAUTHN_RP_ID=your.production.domain
 *   WEBAUTHN_ORIGIN=https://your.production.domain
 *
 * Preview (*.vercel.app) generally needs its own RP ID matching the preview host
 * or WebAuthn will fail origin/RP checks — do NOT weaken validation for previews.
 */

import { readGhcServerEnv } from "@/lib/server/economy/env"

export type WebAuthnRpConfig = {
  rpID: string
  rpName: string
  origin: string
  configured: boolean
}

export function getWebAuthnRpConfig(): WebAuthnRpConfig {
  const env = readGhcServerEnv()
  const rpID =
    (process.env.WEBAUTHN_RP_ID || "").trim() ||
    (process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || "").trim()
  const origin =
    (process.env.WEBAUTHN_ORIGIN || "").trim() ||
    (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "")

  // Fallback for local only — never treat as production-safe
  if (!rpID || !origin) {
    if (!env.isProduction) {
      return {
        rpID: "localhost",
        rpName: "GreenHaven CONNECT",
        origin: "http://localhost:3000",
        configured: false,
      }
    }
    return {
      rpID: "",
      rpName: "GreenHaven CONNECT",
      origin: "",
      configured: false,
    }
  }

  return {
    rpID,
    rpName: process.env.WEBAUTHN_RP_NAME?.trim() || "GreenHaven CONNECT",
    origin,
    configured: true,
  }
}

export function isWebAuthnEnabled(): boolean {
  if (process.env.WEBAUTHN_ENABLED === "0") return false
  const cfg = getWebAuthnRpConfig()
  // Allow non-prod localhost; require explicit config in production
  const env = readGhcServerEnv()
  if (env.isProduction) return cfg.configured && Boolean(cfg.rpID && cfg.origin)
  return Boolean(cfg.rpID && cfg.origin)
}
