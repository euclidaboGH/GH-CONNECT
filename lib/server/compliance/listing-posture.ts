/**
 * Phase 4 — Mainnet listing compliance posture (honest self-check).
 * Does not replace Pi review; surfaces what the codebase is designed to uphold.
 */

import { isPiOnlyCommerceEnabled } from "@/lib/server/economy/pi-only-commerce"

export type PostureItem = {
  id: string
  title: string
  status: "pass" | "review" | "operator"
  detail: string
}

export function buildListingCompliancePosture(): {
  items: PostureItem[]
  summary: string
} {
  const piOnly = isPiOnlyCommerceEnabled()
  const items: PostureItem[] = [
    {
      id: "pi_auth_only",
      title: "Pi Authentication primary login",
      status: "pass",
      detail:
        "Server session is issued only after verified Pi /v2/me. No password-based app login for Pioneers.",
    },
    {
      id: "pi_payments",
      title: "In-app π commerce fees",
      status: piOnly ? "pass" : "review",
      detail: piOnly
        ? "Listing and community create fees settle in π under pi-only commerce. GHC remains earn-only."
        : "Dual-rail fees may still be enabled — set GHC_PI_ONLY_COMMERCE=1 for Mainnet-aligned posture.",
    },
    {
      id: "data_minimization",
      title: "Data minimization",
      status: "pass",
      detail:
        "Privacy Policy states Pi auth, no required email/phone for core social use, no sale of personal data.",
    },
    {
      id: "no_social_import",
      title: "No invented Pi social graph",
      status: "pass",
      detail:
        "Messaging, communities, and marketplace reputation live in GreenHaven’s database — not imported private Pi data.",
    },
    {
      id: "trademark",
      title: "Trademark-safe naming",
      status: "pass",
      detail:
        "Product name is GreenHaven / greenhaven.pi — not a pi* brand domain. Official Pi logos must not be used as app branding.",
    },
    {
      id: "utility",
      title: "In-ecosystem utility",
      status: "pass",
      detail:
        "Core journeys (feed, communities, marketplace, messaging) run inside the app / Pi Browser — not a pure external funnel.",
    },
    {
      id: "developer_kyc",
      title: "Developer KYC",
      status: "operator",
      detail: "Complete personal KYC in the Pi KYC app before submitting Mainnet listing.",
    },
    {
      id: "domain_verify",
      title: "Domain verification file",
      status: "operator",
      detail: "Set DOMAIN_VALIDATION_KEY and verify /validation-key.txt for the production host.",
    },
  ]

  const needs = items.filter((i) => i.status !== "pass").length
  const summary =
    needs === 0
      ? "Code posture checks pass. Complete operator steps in the Developer Portal."
      : `${needs} item(s) need review or operator action before Mainnet listing.`

  return { items, summary }
}
