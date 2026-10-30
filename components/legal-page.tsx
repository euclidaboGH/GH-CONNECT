import Link from "next/link"
import type { ReactNode } from "react"
import type { LegalSection } from "@/lib/legal/policy-meta"

/**
 * Public, server-rendered shell for legal / support pages.
 * Reachable without Pi sign-in (Pi Developer Portal + compliance).
 */
export function LegalPage({
  title,
  effectiveDate,
  lastUpdated,
  children,
}: {
  title: string
  effectiveDate?: string
  lastUpdated?: string
  children: ReactNode
}) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl bg-background px-5 pb-20 pt-[max(1.25rem,env(safe-area-inset-top))] text-foreground">
      <nav aria-label="Legal navigation" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        <Link href="/" className="font-bold text-emerald-600">
          ← GreenHaven
        </Link>
        <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
          Privacy
        </Link>
        <Link href="/terms" className="text-muted-foreground hover:text-foreground">
          Terms
        </Link>
        <Link href="/support" className="text-muted-foreground hover:text-foreground">
          Support
        </Link>
      </nav>
      <header className="mt-6 border-b border-border/60 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {(effectiveDate || lastUpdated) && (
          <p className="mt-2 text-[12px] text-muted-foreground">
            {effectiveDate ? <span>Effective: {effectiveDate}</span> : null}
            {effectiveDate && lastUpdated ? <span aria-hidden> · </span> : null}
            {lastUpdated ? <span>Last updated: {lastUpdated}</span> : null}
          </p>
        )}
      </header>
      <div className="mt-6 space-y-5 text-[14px] leading-relaxed">{children}</div>
      <footer className="mt-12 border-t border-border/60 pt-4 text-[12px] text-muted-foreground">
        <nav aria-label="Footer legal links" className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms of Service
          </Link>
          <Link href="/support" className="hover:text-foreground">
            Support
          </Link>
          <Link href="/portal-setup" className="hover:text-foreground">
            Portal setup
          </Link>
        </nav>
      </footer>
    </main>
  )
}

/** Table of contents + section body for long policy documents */
export function LegalDocument({
  intro,
  sections,
}: {
  intro: string
  sections: LegalSection[]
}) {
  return (
    <>
      <p className="text-muted-foreground">{intro}</p>
      <nav
        aria-label="On this page"
        className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm"
      >
        <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">On this page</p>
        <ol className="mt-2 space-y-1.5 text-[13px]">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
              >
                {s.title}
              </a>
              <span className="sr-only"> section {i + 1}</span>
            </li>
          ))}
        </ol>
      </nav>
      {sections.map((s) => (
        <section key={s.id} id={s.id} className="scroll-mt-20 space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-foreground">{s.title}</h2>
          {s.paragraphs.map((p, idx) => (
            <p key={idx} className="text-foreground/90">
              {p}
            </p>
          ))}
        </section>
      ))}
    </>
  )
}
