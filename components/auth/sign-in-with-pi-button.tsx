"use client"

import { useState } from "react"
import { getPiClientId } from "@/lib/pi-env"
import { startPiSignIn } from "@/lib/pi-oauth-client"
import { isPiBrowserRuntime } from "@/lib/pi-native"
import { usePiAuth } from "@/contexts/pi-auth-context"

type Props = {
  className?: string
  label?: string
}

/**
 * Official Pi Sign-in entry.
 * Inside Pi Browser: trigger SDK re-auth (OAuth-in-webview is often blocked by Pi).
 * In ordinary browsers: OAuth implicit flow.
 */
export function SignInWithPiButton({
  className,
  label = "Sign in with Pi",
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const configured = Boolean(getPiClientId())
  const { reinitialize } = usePiAuth()

  const onClick = async () => {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      // Pi Browser: OAuth redirect pages often reject in-app WebViews.
      // Prefer the official SDK authenticate path already used by the provider.
      if (typeof window !== "undefined" && isPiBrowserRuntime()) {
        await reinitialize()
        setBusy(false)
        return
      }
      const result = startPiSignIn()
      if (!result.ok) {
        setError(result.error)
        setBusy(false)
      }
      // On OAuth success the page navigates away
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed. Try again.")
      setBusy(false)
    }
  }

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={busy || (!configured && !isPiBrowserRuntime())}
        onClick={() => void onClick()}
        className={
          className ||
          "w-full rounded-full bg-[#F5C242] px-6 py-3.5 text-sm font-bold text-[#1a1200] shadow-lg shadow-amber-900/20 transition hover:bg-[#ffd45c] active:scale-[0.98] disabled:opacity-60"
        }
      >
        {busy ? "Connecting to Pi…" : label}
      </button>
      {!configured && !isPiBrowserRuntime() ? (
        <p className="max-w-xs text-center text-[11px] text-white/40">
          Pi Sign-in Client ID is not configured (NEXT_PUBLIC_PI_CLIENT_ID).
        </p>
      ) : null}
      {error ? (
        <p className="max-w-xs text-center text-[12px] text-rose-300/90" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
