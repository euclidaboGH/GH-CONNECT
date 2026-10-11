import Link from "next/link"
import type { ReactNode } from "react"

/**
 * Public, server-rendered shell for legal / support pages.
 * Reachable without signing in (required by Pi Developer Portal and app stores).
 */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl bg-background px-5 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] text-foreground">
      <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        <Link href="/" className="font-bold text-emerald-600">
          ← GreenHaven
        </Link>
        <Link href="/terms" className="text-muted-foreground hover:text-foreground">
          Terms
        </Link>
        <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
          Privacy
        </Link>
        <Link href="/support" className="text-muted-foreground hover:text-foreground">
          Support
        </Link>
      </nav>
      <h1 className="mt-6 text-2xl font-bold">{title}</h1>
      <div className="mt-4 space-y-4 text-[14px] leading-relaxed">{children}</div>
    </main>
  )
}
