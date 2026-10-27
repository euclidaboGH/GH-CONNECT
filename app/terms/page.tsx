import type { Metadata } from "next"
import { LegalDocument, LegalPage } from "@/components/legal-page"
import { POLICY_META } from "@/lib/legal/policy-meta"
import { TERMS_INTRO, TERMS_SECTIONS } from "@/lib/legal/terms-of-service"

export const metadata: Metadata = {
  title: "Terms of Service · GreenHaven",
  description:
    "Terms governing use of GreenHaven, including accounts, content, GHC utility ledger, and Pi payments.",
  robots: { index: true, follow: true },
}

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      effectiveDate={POLICY_META.termsEffectiveDate}
      lastUpdated={POLICY_META.termsLastUpdated}
    >
      <LegalDocument intro={TERMS_INTRO} sections={TERMS_SECTIONS} />
    </LegalPage>
  )
}
