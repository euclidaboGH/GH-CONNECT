/**
 * Maps GreenHaven deployment state to Pi Developer Portal checklist items.
 * Does not mark portal steps complete — operator must still click through the portal.
 * Unique Pioneer engagement is measured as durable verified Pi identities only;
 * Pi KYC status is not available to third-party apps (honest limitation).
 */

import { readGhcServerEnv } from "@/lib/server/economy/env"
import { isPiIdentityDurable } from "@/lib/server/identity/pi-identity-store"
import { isSessionStoreDurable } from "@/lib/server/identity/session-store"
import { isPiOnlyCommerceEnabled } from "@/lib/server/economy/pi-only-commerce"
import { countEngagedPioneers } from "@/lib/server/engagement/pioneer-activity"

export type ChecklistItem = {
  id: string
  title: string
  portalMapsTo: string
  status: "ready" | "action_required" | "operator_portal" | "external"
  detail: string
  evidence?: string
}

async function countDurablePiIdentities(): Promise<number | null> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null
  try {
    const base = env.supabaseUrl.replace(/\/$/, "")
    // Prefer count header
    const res = await fetch(
      `${base}/rest/v1/gh_pi_identities?select=gh_user_id`,
      {
        headers: {
          apikey: env.supabaseServiceRoleKey,
          Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
          Prefer: "count=exact",
          Range: "0-0",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      },
    )
    const range = res.headers.get("content-range") || ""
    const m = range.match(/\/(\d+)\s*$/)
    if (m) return Number(m[1])
    if (res.ok) {
      const rows = (await res.json().catch(() => [])) as unknown[]
      return Array.isArray(rows) ? rows.length : null
    }
    return null
  } catch {
    return null
  }
}

export async function buildPiListingReadiness(): Promise<{
  ok: true
  domainTarget: string
  claimDeadlineHint: string
  uniqueVerifiedPioneers: number | null
  domainThreshold: number
  domainThresholdMet: boolean | null
  checklist: ChecklistItem[]
  principles: string[]
}> {
  const domainKeyConfigured = Boolean(String(process.env.DOMAIN_VALIDATION_KEY || "").trim())
  const piApiKey = Boolean(String(process.env.PI_API_KEY || "").trim())
  const publicAppUrl = String(process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "").trim()
  const sandbox = String(process.env.NEXT_PUBLIC_PI_SANDBOX || "").toLowerCase()
  const piEnv = String(process.env.PI_ENV || "").toLowerCase()
  const privacyPath = "/privacy"
  const termsPath = "/terms"

  const unique = await countDurablePiIdentities()
  const engaged = await countEngagedPioneers()
  const engagedN = engaged.engagedEstimate
  const threshold = 5
  const domainThresholdMet =
    engagedN != null ? engagedN >= threshold : unique == null ? null : unique >= threshold

  const checklist: ChecklistItem[] = [
    {
      id: "hosting",
      title: "Hosting configured",
      portalMapsTo: "App Configuration → Hosting",
      status: publicAppUrl ? "ready" : "action_required",
      detail: publicAppUrl
        ? `Deployment reachable at ${publicAppUrl.startsWith("http") ? publicAppUrl : `https://${publicAppUrl}`}`
        : "Set NEXT_PUBLIC_APP_URL to your production host (e.g. https://your-domain.com).",
      evidence: publicAppUrl || undefined,
    },
    {
      id: "app_wallet",
      title: "Connected app wallet",
      portalMapsTo: "Developer Portal → App wallet",
      status: "operator_portal",
      detail:
        "Create/connect the app wallet inside the Pi Developer Portal (Mainnet project). Wallet address is portal-side, not stored as a user balance in GreenHaven.",
    },
    {
      id: "dev_url",
      title: "Development URL",
      portalMapsTo: "App Configuration → Development URL",
      status: "operator_portal",
      detail: "Enter your Vercel Preview or localhost URL in the portal for sandbox testing.",
    },
    {
      id: "sandbox_run",
      title: "Sandbox run",
      portalMapsTo: "Checklist → Sandbox",
      status: sandbox === "true" || piEnv === "sandbox" ? "ready" : "action_required",
      detail:
        sandbox === "true" || piEnv === "sandbox"
          ? "NEXT_PUBLIC_PI_SANDBOX / PI_ENV indicate sandbox mode for the Testnet app project."
          : "For Testnet project use sandbox=true. For Mainnet project use production keys and sandbox=false.",
    },
    {
      id: "developer_guide",
      title: "Developer guide opened",
      portalMapsTo: "Portal checklist step",
      status: "operator_portal",
      detail: "Open the official Pi developer guide inside the portal checklist (manual portal step).",
    },
    {
      id: "production_url",
      title: "Production URL with verified domain",
      portalMapsTo: "App Configuration → Production URL + domain verify",
      status: domainKeyConfigured ? "ready" : "action_required",
      detail: domainKeyConfigured
        ? "DOMAIN_VALIDATION_KEY is set. Serve https://<your-domain>/validation-key.txt and click Verify in the portal."
        : "Set DOMAIN_VALIDATION_KEY to the exact string from the Pi Developer Portal, then verify domain.",
      evidence: "/validation-key.txt → /api/validation-key",
    },
    {
      id: "privacy_policy",
      title: "Privacy Policy URL",
      portalMapsTo: "App Configuration → Privacy Policy URL",
      status: "ready",
      detail: "Paste the absolute Privacy Policy URL into the portal.",
      evidence: privacyPath + " (and " + termsPath + " for terms)",
    },
    {
      id: "pi_api_key",
      title: "Server API key configured",
      portalMapsTo: "Platform API / payments",
      status: piApiKey ? "ready" : "action_required",
      detail: piApiKey
        ? "PI_API_KEY present for /v2/me and payment server calls."
        : "Set PI_API_KEY from the Developer Portal (separate keys for Testnet vs Mainnet apps).",
    },
    {
      id: "identity_durable",
      title: "Durable Pi identity + sessions",
      portalMapsTo: "Utility / compliance",
      status: isPiIdentityDurable() && isSessionStoreDurable() ? "ready" : "action_required",
      detail:
        isPiIdentityDurable() && isSessionStoreDurable()
          ? "gh_pi_identities and sessions use privileged database configuration."
          : "Configure SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and apply identity/session migrations.",
    },
    {
      id: "pi_only_commerce",
      title: "π commerce fees (listing posture)",
      portalMapsTo: "Utility / compliance",
      status: isPiOnlyCommerceEnabled() ? "ready" : "action_required",
      detail: isPiOnlyCommerceEnabled()
        ? "GHC_PI_ONLY_COMMERCE on — listing/community fees settle in π; GHC is earn-only."
        : "Enable GHC_PI_ONLY_COMMERCE=1 for Mainnet-aligned fee rails unless policy says otherwise.",
    },
    {
      id: "domain_engagement",
      title: "≥5 unique verified Pioneers engaged",
      portalMapsTo: "greenhaven.pi domain claim threshold",
      status:
        domainThresholdMet === true
          ? "ready"
          : domainThresholdMet === false
            ? "action_required"
            : "external",
      detail:
        unique == null
          ? "Could not count gh_pi_identities (check Supabase). Portal requires 5 unique KYC'd Pioneers — GreenHaven only sees verified Pi sign-ins, not Pi KYC status."
          : `${unique} durable verified Pi identities on this deployment. Portal still requires KYC'd Pioneers (KYC is on Pi's side). Invite real Pioneers to sign in and use the app before Dec 19, 2026.`,
      evidence: unique != null ? `count=${unique}` : undefined,
    },
  ]

  return {
    ok: true,
    domainTarget: "greenhaven.pi",
    claimDeadlineHint: "2026-12-19 (tentative claim window per Pi domain notice)",
    uniqueVerifiedPioneers: unique,
    domainThreshold: threshold,
    domainThresholdMet,
    checklist,
    principles: [
      "Register separate Testnet and Mainnet apps in the Pi Developer Portal.",
      "Pi KYC of Pioneers is not exposed to apps — grow real engaged sign-ins; portal measures KYC'd users.",
      "Developer must complete personal KYC before Mainnet listing submission.",
      "Utility: social + marketplace + communities with π payments — not a funnel off-ecosystem.",
      "Do not use domains starting with “pi” or misuse Pi trademarks.",
    ],
  }
}
