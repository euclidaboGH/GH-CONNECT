import type { Metadata } from "next"
import { FieldDeskClient } from "@/components/field/field-desk-client"

export const metadata: Metadata = {
  title: "Field Desk · GreenHaven",
  description:
    "Public field desk for elections, surveys, and situation reports. Works in any browser. Access-code required; no Pi account needed.",
  robots: { index: false, follow: false },
}

/**
 * Public Field Desk — not gated by Pi Browser or GreenHaven login.
 * Scoped access codes only; cannot reach wallet, economy, or user accounts.
 */
export default function FieldDeskPage() {
  return <FieldDeskClient />
}
