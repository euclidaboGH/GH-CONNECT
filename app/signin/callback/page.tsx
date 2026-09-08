"use client"

/**
 * Pi Sign-in OAuth implicit callback.
 *
 * Reads access_token from URL fragment (never sent to server by the browser),
 * validates state, then POST /api/auth/pi to mint existing gh_session.
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BrandLogo } from "@/components/ghc/brand-logo"
import { consumePiOAuthCallback } from "@/lib/pi-oauth-client"

export default function PiSignInCallbackPage() {
  const router = useRouter()
  const [message, setMessage] = useState("Completing Pi Sign-in…")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      const result = consumePiOAuthCallback()
      if (!result.ok) {
        if (!cancelled) {
          setError(result.error)
          setMessage("Sign-in could not be completed")
        }
        return
      }

      try {
        const res = await fetch("/api/auth/pi", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: result.accessToken }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.ok) {
          if (!cancelled) {
            setError(
              data.detail ||
                data.error ||
                "Could not verify Pi identity. Please try again."
            )
            setMessage("Verification failed")
          }
          return
        }

        if (!cancelled) {
          setMessage(
            data.needsOnboarding
              ? "Welcome — continuing setup…"
              : "Signed in — opening GreenHaven…"
          )
        }

        // Soft signal for in-app listeners; identity already on gh_session cookie
        try {
          window.dispatchEvent(
            new CustomEvent("ghc:pi-identity-ready", {
              detail: {
                isReturning: Boolean(data.isReturning),
                needsOnboarding: Boolean(data.needsOnboarding),
                identity: data.identity,
              },
            })
          )
        } catch {
          /* */
        }

        // Prefer home; onboarding gates remain in existing app flow
        window.setTimeout(() => {
          if (!cancelled) router.replace("/")
        }, 400)
      } catch {
        if (!cancelled) {
          setError("Network error while creating your session.")
          setMessage("Sign-in failed")
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#050a08] px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.16)_0%,transparent_60%)]" />
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
        <BrandLogo size="hero" priority className="mb-6 drop-shadow-[0_0_40px_rgba(16,185,129,0.4)]" />
        {!error ? (
          <div
            className="mb-4 h-9 w-9 animate-spin rounded-full border-2 border-emerald-500/25 border-t-emerald-400"
            role="status"
            aria-label="Signing in"
          />
        ) : (
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/15 ring-1 ring-rose-400/30"
            aria-hidden
          >
            <span className="text-2xl text-rose-400">!</span>
          </div>
        )}
        <h1 className="text-lg font-bold tracking-tight text-white">{message}</h1>
        {error ? (
          <>
            <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-rose-300/90">
              {error}
            </p>
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="mt-6 w-full rounded-full bg-emerald-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400"
            >
              Back to GreenHaven
            </button>
          </>
        ) : (
          <p className="mt-2 text-[13px] text-white/50">
            Verifying your Pi identity and opening your session…
          </p>
        )}
      </div>
    </div>
  )
}
