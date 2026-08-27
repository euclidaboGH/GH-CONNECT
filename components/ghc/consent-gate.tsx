"use client"

import { useEffect, useState } from "react"
import {
  REQUIRED_CONSENTS,
  POLICY_COPY,
  acceptConsents,
  hasRequiredConsents,
  loadConsents,
  type ConsentKey,
} from "@/lib/compliance/privacy"

/**
 * Blocks main app until required Pi-aligned consents are accepted.
 */
export function ConsentGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [checked, setChecked] = useState<Record<string, boolean>>({
    terms_of_use: false,
    privacy_policy: false,
    community_guidelines: false,
    optional_analytics: false,
    optional_personalized_discovery: true,
  })

  useEffect(() => {
    const records = loadConsents()
    setAllowed(hasRequiredConsents(records))
    setReady(true)
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    )
  }

  if (allowed) return <>{children}</>

  const allRequired = REQUIRED_CONSENTS.every((k) => checked[k])

  const onContinue = () => {
    if (!allRequired) return
    const keys = (Object.keys(checked) as ConsentKey[]).filter((k) => checked[k])
    acceptConsents(keys)
    setAllowed(true)
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 px-5 py-10">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-black text-gray-900">Welcome to GH Connect</h1>
        <p className="text-sm leading-relaxed text-gray-600">
          A social & dating app on Pi Network. Please review and accept the following to continue.
        </p>
      </div>

      <div className="space-y-3 rounded-3xl border border-purple-100 bg-white p-4 shadow-sm">
        {REQUIRED_CONSENTS.map((key) => (
          <label
            key={key}
            className="flex cursor-pointer gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3"
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-purple-600"
              checked={Boolean(checked[key])}
              onChange={(e) =>
                setChecked((c) => ({ ...c, [key]: e.target.checked }))
              }
            />
            <span>
              <span className="block text-sm font-bold text-gray-900">
                {POLICY_COPY[key].title} <span className="text-red-500">*</span>
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-gray-600">
                {POLICY_COPY[key].summary}
              </span>
            </span>
          </label>
        ))}

        {(["optional_analytics", "optional_personalized_discovery"] as ConsentKey[]).map(
          (key) => (
            <label
              key={key}
              className="flex cursor-pointer gap-3 rounded-2xl border border-dashed border-gray-200 p-3"
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-purple-600"
                checked={Boolean(checked[key])}
                onChange={(e) =>
                  setChecked((c) => ({ ...c, [key]: e.target.checked }))
                }
              />
              <span>
                <span className="block text-sm font-bold text-gray-900">
                  {POLICY_COPY[key].title}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-gray-600">
                  {POLICY_COPY[key].summary}
                </span>
              </span>
            </label>
          )
        )}
      </div>

      <button
        type="button"
        disabled={!allRequired}
        onClick={onContinue}
        className="min-h-12 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-500 text-sm font-bold text-white shadow-md transition enabled:hover:from-purple-700 enabled:hover:to-pink-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Agree & Continue
      </button>

      <p className="text-center text-[11px] leading-relaxed text-gray-400">
        GH Connect follows Pi Network guidelines: no scams, no harassment, no illegal content.
        You can manage privacy anytime in Settings.
      </p>
    </div>
  )
}
