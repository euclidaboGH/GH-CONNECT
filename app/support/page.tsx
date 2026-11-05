import type { Metadata } from "next"
import Link from "next/link"
import { LegalPage } from "@/components/legal-page"
import { POLICY_META } from "@/lib/legal/policy-meta"
import { SUPPORT_CATEGORIES, SUPPORT_FAQS, SUPPORT_INTRO } from "@/lib/legal/support-content"
import { SUPPORT_CONTACTS } from "@/lib/ghc-data"

export const metadata: Metadata = {
  title: "Help & Support · GreenHaven",
  description: "GreenHaven help centre: Pi sign-in, wallet, rewards, payments, privacy requests, and safety.",
  robots: { index: true, follow: true },
}

const card =
  "block rounded-2xl border border-border bg-card p-4 transition hover:border-emerald-500/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"

export default function SupportPage() {
  return (
    <LegalPage title="Help & Support" lastUpdated={POLICY_META.supportLastUpdated}>
      <p className="text-muted-foreground">{SUPPORT_INTRO}</p>

      <section aria-labelledby="contact-heading" className="space-y-3">
        <h2 id="contact-heading" className="text-lg font-bold">
          Contact
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <a href={`mailto:${SUPPORT_CONTACTS.email}`} className={card}>
            <p className="text-[15px] font-bold">Email</p>
            <p className="text-[13px] text-muted-foreground">{SUPPORT_CONTACTS.email}</p>
          </a>
          <a
            href={`https://wa.me/${SUPPORT_CONTACTS.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className={card}
          >
            <p className="text-[15px] font-bold">WhatsApp</p>
            <p className="text-[13px] text-muted-foreground">{SUPPORT_CONTACTS.whatsapp}</p>
          </a>
          <a href={SUPPORT_CONTACTS.facebook} target="_blank" rel="noopener noreferrer" className={card}>
            <p className="text-[15px] font-bold">Facebook</p>
            <p className="text-[13px] text-muted-foreground">GreenHavenXpres</p>
          </a>
          <Link href="/portal-setup" className={card}>
            <p className="text-[15px] font-bold">Pi Portal setup</p>
            <p className="text-[13px] text-muted-foreground">Privacy URL, domain validation, listing checklist</p>
          </Link>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Never send Pi passphrases, private keys, passwords, or full payment credentials through support channels.
        </p>
      </section>

      <section aria-labelledby="faq-heading" className="space-y-4">
        <h2 id="faq-heading" className="text-lg font-bold">
          Frequently asked questions
        </h2>
        {SUPPORT_CATEGORIES.map((category) => (
          <div key={category} className="space-y-2">
            <h3 className="text-[13px] font-bold uppercase tracking-wide text-muted-foreground">{category}</h3>
            <div className="space-y-2">
              {SUPPORT_FAQS.filter((f) => f.category === category).map((faq) => (
                <details
                  key={faq.id}
                  id={faq.id}
                  className="group rounded-2xl border border-border bg-card px-4 py-3 open:shadow-sm"
                >
                  <summary className="cursor-pointer list-none text-[14px] font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="flex items-start justify-between gap-2">
                      <span>{faq.question}</span>
                      <span className="shrink-0 text-muted-foreground transition group-open:rotate-45" aria-hidden>
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-muted/30 p-4 text-[13px] text-muted-foreground">
        <p>
          Legal documents:{" "}
          <Link href="/privacy" className="font-semibold text-emerald-700 underline dark:text-emerald-400">
            Privacy Policy
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="font-semibold text-emerald-700 underline dark:text-emerald-400">
            Terms of Service
          </Link>
          .
        </p>
      </section>
    </LegalPage>
  )
}
