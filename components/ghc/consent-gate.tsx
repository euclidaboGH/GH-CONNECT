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
import { BrandLogo } from "./brand-logo"
import { Check, ChevronDown, Shield } from "lucide-react"

/**
 * Blocks main app until required Pi-aligned consents are accepted.
 * Premium welcome experience — not a compliance form dump.
 */
export function ConsentGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [optionalOpen, setOptionalOpen] = useState(false)
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
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#050a08] text-sm text-white/50">
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

  const toggle = (key: ConsentKey) =>
    setChecked((c) => ({ ...c, [key]: !c[key] }))

  return (
    <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col overflow-y-auto bg-[#050a08] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      {/* Soft brand glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.22)_0%,transparent_70%)]"
        aria-hidden
      />

      <div className="relative z-10 flex flex-1 flex-col justify-center gap-6 py-6">
        {/* Hero */}
        <div className="flex flex-col items-center text-center">
          <BrandLogo size="lg" priority className="drop-shadow-[0_0_28px_rgba(16,185,129,0.35)]" />
          <h1 className="mt-5 text-[1.65rem] font-black tracking-tight text-white">
            Welcome to GreenHaven
          </h1>
          <p className="mt-2 max-w-[17rem] text-[13px] leading-relaxed text-white/55">
            Connect with people.
            <br />
            Build communities.
            <br />
            <span className="font-semibold text-emerald-300/90">Participate. Earn. Grow.</span>
          </p>
        </div>

        {/* Value strip */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { t: "Connect", d: "People & chats" },
            { t: "Participate", d: "Posts & groups" },
            { t: "Earn", d: "GHC & rewards" },
          ].map((item) => (
            <div
              key={item.t}
              className="rounded-2xl border border-white/8 bg-white/[0.04] px-2 py-2.5 text-center"
            >
              <p className="text-[11px] font-bold text-emerald-300">{item.t}</p>
              <p className="mt-0.5 text-[10px] text-white/40">{item.d}</p>
            </div>
          ))}
        </div>

        {/* Before you begin — required */}
        <section
          className="rounded-3xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-sm"
          aria-label="Before you begin"
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <Shield size={16} />
            </span>
            <div>
              <p className="text-[13px] font-bold text-white">Before you begin</p>
              <p className="text-[11px] text-white/45">Required · takes a moment</p>
            </div>
          </div>

          <ul className="space-y-2">
            {REQUIRED_CONSENTS.map((key) => {
              const on = Boolean(checked[key])
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                      on
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-white/8 bg-white/[0.03] hover:border-white/15"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        on
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-white/25 bg-transparent"
                      }`}
                      aria-hidden
                    >
                      {on ? <Check size={12} strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-white">
                        {POLICY_COPY[key].title}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-white/45">
                        {POLICY_COPY[key].summary}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        {/* Optional — collapsed */}
        <section className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02]">
          <button
            type="button"
            onClick={() => setOptionalOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
            aria-expanded={optionalOpen}
          >
            <div>
              <p className="text-[13px] font-bold text-white/90">Personalize your experience</p>
              <p className="text-[11px] text-white/40">Optional · you can change this later</p>
            </div>
            <ChevronDown
              size={18}
              className={`shrink-0 text-white/40 transition ${optionalOpen ? "rotate-180" : ""}`}
            />
          </button>

          {optionalOpen ? (
            <div className="space-y-2 border-t border-white/8 px-3 pb-3 pt-2">
              {(["optional_analytics", "optional_personalized_discovery"] as ConsentKey[]).map(
                (key) => {
                  const on = Boolean(checked[key])
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggle(key)}
                      className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                        on
                          ? "border-emerald-500/30 bg-emerald-500/8"
                          : "border-white/8 bg-transparent"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          on
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-white/25"
                        }`}
                        aria-hidden
                      >
                        {on ? <Check size={12} strokeWidth={3} /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-white/90">
                          {POLICY_COPY[key].title}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-relaxed text-white/40">
                          {POLICY_COPY[key].summary}
                        </span>
                      </span>
                    </button>
                  )
                }
              )}
            </div>
          ) : null}
        </section>

        <button
          type="button"
          disabled={!allRequired}
          onClick={onContinue}
          className="min-h-12 w-full rounded-2xl bg-emerald-600 text-sm font-bold text-white shadow-lg shadow-emerald-900/40 transition enabled:hover:bg-emerald-500 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>

        <p className="text-center text-[11px] leading-relaxed text-white/35">
          GreenHaven follows Pi Network guidelines. You can manage privacy anytime in Settings.
        </p>
      </div>
    </div>
  )
}
