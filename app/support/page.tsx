import type { Metadata } from "next"
import { LegalPage } from "@/components/legal-page"
import { SUPPORT_CONTACTS } from "@/lib/ghc-data"

export const metadata: Metadata = { title: "Help & Support" }

const card =
  "block rounded-2xl border border-border bg-card p-4 transition hover:border-emerald-500"

export default function SupportPage() {
  return (
    <LegalPage title="Help & Support">
      <p className="text-muted-foreground">Reach the GreenHaven team through any of these channels.</p>
      <a href={`mailto:${SUPPORT_CONTACTS.email}`} className={card}>
        <p className="text-[15px] font-bold">Email Support</p>
        <p className="text-[13px] text-muted-foreground">{SUPPORT_CONTACTS.email}</p>
      </a>
      <a
        href={`https://wa.me/${SUPPORT_CONTACTS.whatsapp.replace(/\D/g, "")}`}
        target="_blank"
        rel="noopener noreferrer"
        className={card}
      >
        <p className="text-[15px] font-bold">WhatsApp Support</p>
        <p className="text-[13px] text-muted-foreground">{SUPPORT_CONTACTS.whatsapp}</p>
      </a>
      <a href={SUPPORT_CONTACTS.facebook} target="_blank" rel="noopener noreferrer" className={card}>
        <p className="text-[15px] font-bold">Facebook</p>
        <p className="text-[13px] text-muted-foreground">GreenHavenXpres</p>
      </a>
    </LegalPage>
  )
}
