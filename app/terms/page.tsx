import type { Metadata } from "next"
import { LegalPage } from "@/components/legal-page"
import { LEGAL } from "@/lib/ghc-data"

export const metadata: Metadata = { title: "Terms of Service" }

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <div className="whitespace-pre-wrap">{LEGAL.terms}</div>
    </LegalPage>
  )
}
