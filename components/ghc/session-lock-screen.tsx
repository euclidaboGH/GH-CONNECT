"use client"

/**
 * Soft-lock + PIN setup UI.
 * Protects the local device session after Pi authentication.
 * Does not replace Pi Network identity.
 */

import { useState, useCallback, useEffect, useRef } from "react"
import { BrandLogo } from "./brand-logo"
import { useSessionLock } from "@/contexts/session-lock-context"
import { IdentityService } from "@/lib/identity/identity-service"
import { PIN_MAX_LEN, PIN_MIN_LEN } from "@/lib/session-security"
import { usePiAuth } from "@/contexts/pi-auth-context"
import { Delete, Lock, ShieldCheck } from "lucide-react"

type Mode = "unlock" | "setup" | "confirm"

export function SessionLockGate({ children }: { children: React.ReactNode }) {
  const {
    isLocked,
    needsPinSetup,
    pinConfigured,
    unlockWithPin,
    configurePin,
    skipPinSetupForNow,
    idleLockMs,
  } = useSessionLock()
  const { reinitialize } = usePiAuth()

  if (needsPinSetup && !pinConfigured) {
    return (
      <PinSheet
        mode="setup"
        title="Protect this device"
        subtitle={`Create a ${PIN_MIN_LEN}–${PIN_MAX_LEN} digit PIN. After ${Math.round(idleLockMs / 60000)} minutes idle, GreenHaven will ask for it — like a banking app. Your Pi account stays the real identity.`}
        primaryLabel="Save PIN"
        onSubmit={async (pin) => {
          const r = await configurePin(pin)
          return r
        }}
        secondaryLabel="Set up later"
        onSecondary={skipPinSetupForNow}
      />
    )
  }

  if (isLocked) {
    return (
      <PinSheet
        mode="unlock"
        title="Session locked"
        subtitle={
          pinConfigured
            ? "Enter your GreenHaven PIN to continue. This protects your account if someone else picks up your phone."
            : "This session was locked for safety. Sign in again with Pi Network."
        }
        primaryLabel={pinConfigured ? "Unlock" : "Sign in with Pi"}
        onSubmit={async (pin) => {
          if (!pinConfigured) {
            try {
              IdentityService.clear()
            } catch {
              /* */
            }
            void reinitialize()
            return { ok: true }
          }
          return unlockWithPin(pin)
        }}
        secondaryLabel="Use Pi sign-in instead"
        onSecondary={() => {
          try {
            IdentityService.clear()
          } catch {
            /* */
          }
          void reinitialize()
        }}
      />
    )
  }

  return <>{children}</>
}

function PinSheet({
  mode,
  title,
  subtitle,
  primaryLabel,
  onSubmit,
  secondaryLabel,
  onSecondary,
}: {
  mode: Mode | "unlock" | "setup"
  title: string
  subtitle: string
  primaryLabel: string
  onSubmit: (pin: string) => Promise<{ ok: boolean; error?: string }>
  secondaryLabel?: string
  onSecondary?: () => void
}) {
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [phase, setPhase] = useState<"enter" | "confirm">(
    mode === "setup" ? "enter" : "enter"
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [phase])

  const activePin = phase === "confirm" ? confirmPin : pin
  const setActivePin = phase === "confirm" ? setConfirmPin : setPin

  const pushDigit = useCallback(
    (d: string) => {
      setError(null)
      setActivePin((p) => (p.length >= PIN_MAX_LEN ? p : p + d))
    },
    [setActivePin]
  )

  const backspace = useCallback(() => {
    setError(null)
    setActivePin((p) => p.slice(0, -1))
  }, [setActivePin])

  const submit = useCallback(async () => {
    if (busy) return
    if (mode === "setup" && phase === "enter") {
      if (pin.length < PIN_MIN_LEN) {
        setError(`Use at least ${PIN_MIN_LEN} digits`)
        return
      }
      setPhase("confirm")
      setConfirmPin("")
      return
    }
    if (mode === "setup" && phase === "confirm") {
      if (confirmPin !== pin) {
        setError("PINs do not match. Try again.")
        setPhase("enter")
        setPin("")
        setConfirmPin("")
        return
      }
    }
    const value = mode === "setup" ? pin : activePin
    if (mode === "unlock" && pinConfiguredLengthGuard(value)) {
      /* continue */
    } else if (mode === "unlock" && value.length < PIN_MIN_LEN) {
      setError("Enter your PIN")
      return
    }
    setBusy(true)
    try {
      const result = await onSubmit(value)
      if (!result.ok) {
        setError(result.error || "Failed")
        setPin("")
        setConfirmPin("")
        setPhase("enter")
      }
    } finally {
      setBusy(false)
    }
  }, [busy, mode, phase, pin, confirmPin, activePin, onSubmit])

  // Auto-submit unlock when max length reached
  useEffect(() => {
    if (mode === "unlock" && pin.length >= PIN_MIN_LEN && pin.length === PIN_MAX_LEN) {
      void submit()
    }
  }, [pin, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#050a08] px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.14)_0%,transparent_60%)]" />
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30">
          {mode === "setup" ? <ShieldCheck size={28} /> : <Lock size={28} />}
        </div>
        <BrandLogo size="bar" className="mb-4 opacity-90" />
        <h1 className="text-xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-white/50">{subtitle}</p>
        {mode === "setup" && phase === "confirm" ? (
          <p className="mt-2 text-[12px] font-semibold text-emerald-300/90">Confirm your PIN</p>
        ) : null}

        {/* Dots */}
        <div className="mt-8 flex items-center gap-2.5" aria-hidden>
          {Array.from({ length: Math.max(PIN_MIN_LEN, activePin.length || PIN_MIN_LEN) }).map(
            (_, i) => (
              <span
                key={i}
                className={`h-3 w-3 rounded-full transition ${
                  i < activePin.length
                    ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]"
                    : "bg-white/15"
                }`}
              />
            )
          )}
        </div>

        {/* Hidden input for accessibility / hardware keyboards */}
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={PIN_MAX_LEN}
          value={activePin}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, PIN_MAX_LEN)
            setError(null)
            setActivePin(v)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit()
          }}
          className="sr-only"
          aria-label="PIN"
        />

        {error ? (
          <p className="mt-4 text-[13px] font-medium text-rose-300" role="alert">
            {error}
          </p>
        ) : (
          <p className="mt-4 text-[11px] text-white/30">Digits only · stays on this device</p>
        )}

        {/* Keypad */}
        <div className="mt-6 grid w-full max-w-[240px] grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key) => {
            if (key === "") return <div key="empty" />
            if (key === "del") {
              return (
                <button
                  key="del"
                  type="button"
                  onClick={backspace}
                  className="flex h-14 items-center justify-center rounded-2xl text-white/70 transition hover:bg-white/10 active:scale-95"
                  aria-label="Delete"
                >
                  <Delete size={22} />
                </button>
              )
            }
            return (
              <button
                key={key}
                type="button"
                onClick={() => pushDigit(key)}
                className="flex h-14 items-center justify-center rounded-2xl bg-white/[0.06] text-lg font-bold text-white ring-1 ring-white/10 transition hover:bg-white/10 active:scale-95"
              >
                {key}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="mt-6 w-full rounded-full bg-emerald-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {busy ? "Please wait…" : primaryLabel}
        </button>

        {secondaryLabel && onSecondary ? (
          <button
            type="button"
            onClick={onSecondary}
            className="mt-3 text-[12px] font-semibold text-white/45 hover:text-white/70"
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function pinConfiguredLengthGuard(_pin: string) {
  return true
}
