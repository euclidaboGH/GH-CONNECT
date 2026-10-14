import type { Metadata } from "next"
import { LegalPage } from "@/components/legal-page"
import { LEGAL } from "@/lib/ghc-data"

export const metadata: Metadata = { title: "Privacy Policy" }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <div className="whitespace-pre-wrap">{LEGAL.privacy}</div>
    </LegalPage>
  )
}
