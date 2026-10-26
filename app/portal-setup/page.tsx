import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Portal setup",
  description: "URLs and checklist for Pi Developer Portal configuration of GreenHaven",
}

/**
 * Static-friendly setup page operators can open in a browser to copy portal fields.
 * No secrets; validation key value stays in env only.
 */
export default function PortalSetupPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-8 text-sm text-foreground">
      <h1 className="text-xl font-bold">Pi Developer Portal — GreenHaven</h1>
      <p className="mt-2 text-muted-foreground">
        Use this page while finishing App Configuration. Secrets (API keys, validation key value) stay in
        Vercel env — they are never shown here.
      </p>

      <section className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-bold">Paste into the portal</h2>
        <ul className="list-disc space-y-2 pl-5 text-[13px]">
          <li>
            <span className="font-semibold">Privacy Policy URL</span> —{" "}
            <Link className="text-emerald-700 underline" href="/privacy">
              /privacy
            </Link>{" "}
            (use the full https URL of this deployment)
          </li>
          <li>
            <span className="font-semibold">Terms</span> —{" "}
            <Link className="text-emerald-700 underline" href="/terms">
              /terms
            </Link>
          </li>
          <li>
            <span className="font-semibold">Domain validation file</span> —{" "}
            <a className="text-emerald-700 underline" href="/validation-key.txt">
              /validation-key.txt
            </a>{" "}
            (must match DOMAIN_VALIDATION_KEY)
          </li>
          <li>
            <span className="font-semibold">Production URL</span> — this site’s origin (set NEXT_PUBLIC_APP_URL)
          </li>
        </ul>
      </section>

      <section className="mt-4 space-y-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-bold">Checklist (portal + domain)</h2>
        <ol className="list-decimal space-y-1 pl-5 text-[13px] text-muted-foreground">
          <li>Hosting on Vercel (or your host) live</li>
          <li>App wallet connected in Developer Portal</li>
          <li>Development URL for Testnet app</li>
          <li>Sandbox run completed on Testnet app</li>
          <li>Developer guide step opened in portal</li>
          <li>Production URL + Verify domain</li>
          <li>Privacy Policy URL saved in portal</li>
          <li>Grow ≥5 unique KYC’d Pioneers engaging the app (Pi measures KYC)</li>
        </ol>
        <p className="text-[12px] text-muted-foreground">
          greenhaven.pi tentative claim window: until 19 December 2026.
        </p>
      </section>

      <section className="mt-4 space-y-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-bold">JSON helper</h2>
        <p className="text-[13px] text-muted-foreground">
          Machine-readable links:{" "}
          <a className="text-emerald-700 underline" href="/api/public/portal-links">
            /api/public/portal-links
          </a>
        </p>
        <p className="text-[13px] text-muted-foreground">
          Operator readiness (optional admin key):{" "}
          <code className="text-[11px]">/api/operator/pi-listing-readiness</code>
        </p>
      </section>

      <p className="mt-6 text-[12px] text-muted-foreground">
        <Link href="/" className="underline">
          Back to app
        </Link>
      </p>
    </main>
  )
}
