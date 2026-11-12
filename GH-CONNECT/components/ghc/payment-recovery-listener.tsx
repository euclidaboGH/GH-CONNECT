"use client"

/**
 * Listens for ghc:payment-recovery events (from Pi incomplete-payment callback)
 * and surfaces a calm toast via GHC context when available.
 */

import { useEffect } from "react"
import { useGHC } from "@/contexts/ghc-context"
import {
  recoveryToastMessage,
  type IncompleteRecoveryResult,
} from "@/lib/pi-incomplete-payment"

export function PaymentRecoveryListener() {
  const ghc = useGHC() as { addToast?: (msg: string, type?: string) => void }

  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<IncompleteRecoveryResult>).detail
      if (!detail) return
      const { text, type } = recoveryToastMessage(detail)
      ghc.addToast?.(text, type)
      if (detail.ok) {
        try {
          window.dispatchEvent(
            new CustomEvent("ghc:payment-recovered", { detail }),
          )
        } catch {
          /* */
        }
      }
    }
    window.addEventListener("ghc:payment-recovery", handler as EventListener)
    return () => {
      window.removeEventListener("ghc:payment-recovery", handler as EventListener)
    }
  }, [ghc])

  return null
}
