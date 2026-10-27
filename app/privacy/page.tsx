import type { Metadata } from "next"
import { LegalDocument, LegalPage } from "@/components/legal-page"
import { POLICY_META } from "@/lib/legal/policy-meta"
import { PRIVACY_INTRO, PRIVACY_SECTIONS } from "@/lib/legal/privacy-policy"

export const metadata: Metadata = {
  title: "Privacy Policy · GreenHaven",
  description:
    "How GreenHaven collects, uses, and protects information for Pi-authenticated social, marketplace, and utility features.",
  robots: { index: true, follow: true },
}

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      effectiveDate={POLICY_META.privacyEffectiveDate}
      lastUpdated={POLICY_META.privacyLastUpdated}
    >
      <LegalDocument intro={PRIVACY_INTRO} sections={PRIVACY_SECTIONS} />
    </LegalPage>
  )
}
