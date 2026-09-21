"use client"

import { useState } from "react"
import { getPiClientId } from "@/lib/pi-env"
import { startPiSignIn } from "@/lib/pi-oauth-client"

type Props = {
  className?: string
  label?: string
}

/**
 * Official Pi Sign-in entry (OAuth implicit flow).
 * Does not replace Pi Browser SDK auth; works in ordinary browsers too.
 */
export function SignInWithPiButton({
  className,
  label = "Sign in with Pi",
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const configured = Boolean(getPiClientId())

  const onClick = () => {
    if (busy) return
    setError(null)
    setBusy(true)
    const result = startPiSignIn()
    if (!result.ok) {
      setError(result.error)
      setBusy(false)
    }
    // On success the page navigates away
  }

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={busy || !configured}
        onClick={onClick}
        className={
          className ||
          "w-full rounded-full bg-[#F5C242] px-6 py-3.5 text-sm font-bold text-[#1a1200] shadow-lg shadow-amber-900/20 transition hover:bg-[#ffd45c] active:scale-[0.98] disabled:opacity-60"
        }
      >
        {busy ? "Redirecting to Pi…" : label}
      </button>
      {!configured ? (
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
