"use client"

/**
 * Production-oriented GreenHaven identity QR.
 * Uses the `qrcode` package (well-tested) — no third-party image CDN.
 *
 * Payload is ALWAYS identity-only:
 *   ghc://receive?v=1&id=GH-XXXXXX
 *
 * Never encodes: amount, balance, auth tokens, email, phone, private data.
 */

import { useEffect, useState } from "react"
import {
  buildReceivePayload,
  assertPayloadIsSafe,
  FORBIDDEN_RECEIVE_PARAMS,
} from "@/lib/domains/ghc-receive-payload"
import {
  isValidGreenHavenIdFormat,
  normalizeGreenHavenId,
} from "@/lib/domains/greenhaven-id"

export type GhIdentityQrProps = {
  greenHavenId: string
  size?: number
  className?: string
  /** Optional alt text */
  alt?: string
}

/**
 * Build and validate identity-only payload. Throws if ID invalid.
 */
export function buildIdentityOnlyQrPayload(greenHavenId: string): string {
  const id = normalizeGreenHavenId(greenHavenId)
  if (!isValidGreenHavenIdFormat(id)) {
    throw new Error("Invalid GreenHaven ID")
  }
  const payload = buildReceivePayload(id)
  if (!assertPayloadIsSafe(payload)) {
    throw new Error("Unsafe receive payload rejected")
  }
  for (const key of FORBIDDEN_RECEIVE_PARAMS) {
    if (payload.toLowerCase().includes(`${key}=`)) {
      throw new Error(`Forbidden field in payload: ${key}`)
    }
  }
  return payload
}

export function GhIdentityQr({
  greenHavenId,
  size = 200,
  className = "",
  alt,
}: GhIdentityQrProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<string>("")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const p = buildIdentityOnlyQrPayload(greenHavenId)
        if (cancelled) return
        setPayload(p)
        // Dynamic import — keeps SSR light; requires `qrcode` in package.json
        const QR = await import("qrcode")
        const url = await QR.toDataURL(p, {
          width: size,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#064e3b", light: "#ffffff" },
        })
        if (!cancelled) {
          setDataUrl(url)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "QR unavailable")
          setDataUrl(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [greenHavenId, size])

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-border bg-muted/40 p-4 text-center text-[11px] text-muted-foreground ${className}`}
        style={{ width: size, height: size }}
      >
        {error}
        {payload ? (
          <span className="mt-1 block break-all font-mono text-[10px]">{payload}</span>
        ) : null}
      </div>
    )
  }

  if (!dataUrl) {
    return (
      <div
        className={`animate-pulse rounded-2xl border border-border bg-muted/50 ${className}`}
        style={{ width: size, height: size }}
        aria-busy="true"
        aria-label="Generating QR"
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={alt || `GreenHaven identity QR`}
      className={`rounded-2xl border border-border bg-white p-2 ${className}`}
    />
  )
}
