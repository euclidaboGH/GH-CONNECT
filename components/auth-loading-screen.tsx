"use client"

import { usePiAuth } from "@/contexts/pi-auth-context"
import { allowLocalAuthFallback } from "@/lib/system-config"
import { BrandLogo } from "@/components/ghc/brand-logo"
import { SignInWithPiButton } from "@/components/auth/sign-in-with-pi-button"

export function AuthLoadingScreen() {
  const { authMessage, hasError, reinitialize, continueLocalPreview } = usePiAuth()

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#050a08] px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.16)_0%,transparent_60%)]" />
      <div className="pointer-events-none absolute -left-16 top-20 h-56 w-56 rounded-full bg-emerald-500/15 blur-[90px]" />
      <div className="pointer-events-none absolute -right-12 bottom-24 h-48 w-48 rounded-full bg-teal-400/10 blur-[80px]" />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 scale-110 rounded-full bg-emerald-400/20 blur-3xl" />
          <BrandLogo onDark size="hero" priority className="relative drop-shadow-[0_0_40px_rgba(16,185,129,0.4)]" />
        </div>

        {hasError ? (
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/15 ring-1 ring-rose-400/30"
            aria-hidden
          >
            <svg
              className="h-7 w-7 text-rose-400"
              fill="none"
              strokeWidth="2"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
        ) : (
          <div className="mb-6 w-44" role="status" aria-label="Loading GreenHaven">
            <style>{`
              @keyframes gh-line-slide{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
              @keyframes gh-line-pulse{0%,100%{opacity:.35}50%{opacity:1}}
              @media (prefers-reduced-motion: reduce){.gh-line-bar,.gh-line-dot{animation:none!important}}
            `}</style>
            <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="gh-line-bar absolute inset-y-0 left-0 w-2/5 rounded-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
                style={{ animation: "gh-line-slide 1.4s ease-in-out infinite" }}
              />
            </div>
            <div className="mt-2.5 flex justify-center gap-1.5" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="gh-line-dot h-1 w-6 rounded-full bg-emerald-400/70"
                  style={{ animation: `gh-line-pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
          </div>
        )}

        {hasError ? (
          <>
            <h1 className="text-lg font-bold tracking-tight text-white">
              {authMessage &&
              /server unavailable|api offline|redeploy|identity service/i.test(authMessage)
                ? "Server temporarily unavailable"
                : "Couldn’t sign you in"}
            </h1>
            <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-rose-300/90">{authMessage}</p>
          </>
        ) : (
          <p className="text-[13px] font-medium tracking-wide text-white/55">Getting things ready…</p>
        )}

        {hasError ? (
          <div className="mt-6 flex w-full flex-col items-center gap-3">
            <SignInWithPiButton />
            <>
              <button
                type="button"
                onClick={() => void reinitialize()}
                className="w-full rounded-full bg-emerald-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400 active:scale-[0.98]"
              >
                Retry Pi Browser authentication
              </button>
              {allowLocalAuthFallback() ? (
                <>
                  <button
                    type="button"
                    onClick={continueLocalPreview}
                    className="w-full rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white/90 backdrop-blur transition hover:bg-white/10"
                  >
                    Continue in local preview
                  </button>
                  <p className="max-w-xs text-center text-[11px] text-white/35">
                    Local preview is for development only. Payments still require Pi Browser.
                  </p>
                </>
              ) : (
                <p className="max-w-xs text-center text-[11px] text-white/40">
                  Prefer Pi Browser for payments. Or use Sign in with Pi above in a normal browser.
                </p>
              )}
            </>
          </div>
        ) : null}
      </div>
    </div>
  )
}
