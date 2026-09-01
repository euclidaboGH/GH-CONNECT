"use client"

/**
 * GreenHaven Ecosystem map — how Social, GHC, Marketplace, Community,
 * Charity, and Services connect: Connect → Participate → Earn → Use → Give
 */

import {
  ArrowLeft,
  Users,
  MessageCircle,
  Coins,
  ShoppingBag,
  HeartHandshake,
  GraduationCap,
  Clapperboard,
  Bus,
  Landmark,
  Sparkles,
  ChevronRight,
  Gift,
  Crown,
  Wallet,
} from "lucide-react"

const JOURNEY = [
  { id: "connect", label: "Connect", hint: "People & identity" },
  { id: "participate", label: "Participate", hint: "Posts & communities" },
  { id: "earn", label: "Earn", hint: "GHC & rewards" },
  { id: "use", label: "Use", hint: "Spend & unlock" },
  { id: "give", label: "Give", hint: "Charity & impact" },
] as const

type Pillar = {
  id: string
  title: string
  subtitle: string
  icon: typeof Users
  tone: string
  action?: { event?: string; tab?: string; section?: string }
}

const PILLARS: Pillar[] = [
  {
    id: "social",
    title: "Social",
    subtitle: "Connect & communicate — feed, messages, discover, matches",
    icon: Users,
    tone: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
    action: { tab: "home" },
  },
  {
    id: "ghc",
    title: "GHC",
    subtitle: "Earn & transact — wallet, transfers, rewards ledger",
    icon: Coins,
    tone: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    action: { event: "ghc:open-wallet" },
  },
  {
    id: "marketplace",
    title: "Marketplace",
    subtitle: "Buy & sell — listings, orders, Pay with π or GHC",
    icon: ShoppingBag,
    tone: "bg-amber-500/12 text-amber-800 dark:text-amber-200",
    action: { event: "ghc:open-marketplace" },
  },
  {
    id: "community",
    title: "Community",
    subtitle: "Collaborate — boards, events, roles, chapters",
    icon: MessageCircle,
    tone: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
    action: { tab: "communities" },
  },
  {
    id: "charity",
    title: "Charity",
    subtitle: "Give back — causes and transparent contributions",
    icon: HeartHandshake,
    tone: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
    action: { event: "ghc:open-charity" },
  },
  {
    id: "education",
    title: "Education",
    subtitle: "Learn — skills, mentorship, GreenHaven knowledge",
    icon: GraduationCap,
    tone: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300",
    action: { event: "ghc:open-education" },
  },
  {
    id: "entertainment",
    title: "Entertainment",
    subtitle: "Experience — culture, events, creator content",
    icon: Clapperboard,
    tone: "bg-fuchsia-500/12 text-fuchsia-700 dark:text-fuchsia-300",
    action: { event: "ghc:open-entertainment" },
  },
  {
    id: "transport",
    title: "Transport",
    subtitle: "Move — mobility services in the GreenHaven network",
    icon: Bus,
    tone: "bg-teal-500/12 text-teal-700 dark:text-teal-300",
    action: { event: "ghc:open-transport" },
  },
  {
    id: "ip",
    title: "IP & services",
    subtitle: "Access platform services and digital products",
    icon: Landmark,
    tone: "bg-stone-500/12 text-stone-700 dark:text-stone-300",
    action: { event: "ghc:open-services" },
  },
]

function openPillar(p: Pillar) {
  try {
    if (p.action?.tab) {
      window.dispatchEvent(new CustomEvent("ghc:navigate-tab", { detail: p.action.tab }))
      return
    }
    if (p.action?.section) {
      window.dispatchEvent(
        new CustomEvent("ghc:open-settings-section", { detail: { section: p.action.section } })
      )
      return
    }
    if (p.action?.event) {
      window.dispatchEvent(new CustomEvent(p.action.event, { detail: {} }))
    }
  } catch {
    /* */
  }
}

export function GreenHavenEcosystemScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold">GreenHaven Ecosystem</h1>
          <p className="text-[11px] text-muted-foreground">How everything connects</p>
        </div>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto scrollbar-hide"
        style={{ paddingBottom: "var(--gh-screen-bottom-inset)" }}
      >
        {/* Journey strip */}
        <section className="px-4 pt-4" aria-label="Ecosystem journey">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
            Your path
          </p>
          <p className="mt-1 text-lg font-black tracking-tight text-foreground">
            Connect → Participate → Earn → Use → Give
          </p>
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {JOURNEY.map((j, i) => (
              <div
                key={j.id}
                className="min-w-[4.5rem] flex-1 rounded-[var(--gh-radius-sm)] bg-muted/60 px-2 py-2 text-center"
              >
                <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <p className="text-[11px] font-bold text-foreground">{j.label}</p>
                <p className="text-[9px] text-muted-foreground">{j.hint}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Quick hubs */}
        <section className="mt-4 grid grid-cols-3 gap-2 px-4" aria-label="Quick hubs">
          {[
            {
              label: "Wallet",
              icon: Wallet,
              onClick: () =>
                window.dispatchEvent(new CustomEvent("ghc:open-wallet", { detail: {} })),
            },
            {
              label: "Rewards",
              icon: Gift,
              onClick: () =>
                window.dispatchEvent(
                  new CustomEvent("ghc:open-settings-section", {
                    detail: { section: "rewards" },
                  })
                ),
            },
            {
              label: "Membership",
              icon: Crown,
              onClick: () =>
                window.dispatchEvent(new CustomEvent("ghc:open-membership", { detail: {} })),
            },
          ].map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => {
                try {
                  q.onClick()
                } catch {
                  /* */
                }
              }}
              className="flex flex-col items-center gap-1.5 rounded-[var(--gh-radius-sm)] bg-muted/50 py-3 transition hover:bg-muted active:scale-[0.98]"
            >
              <q.icon size={18} className="text-emerald-700" />
              <span className="text-[11px] font-bold">{q.label}</span>
            </button>
          ))}
        </section>

        {/* Pillars */}
        <section className="mt-5 px-4" aria-label="Ecosystem pillars">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-foreground">
            <Sparkles size={14} className="text-emerald-600" />
            Ecosystem pillars
          </p>
          <ul className="space-y-2">
            {PILLARS.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => openPillar(p)}
                  className="flex w-full items-center gap-3 rounded-[var(--gh-radius-md)] bg-muted/40 px-3 py-3 text-left transition hover:bg-muted active:scale-[0.99]"
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${p.tone}`}
                  >
                    <p.icon size={20} strokeWidth={2.1} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-foreground">{p.title}</span>
                    <span className="block text-[11px] leading-snug text-muted-foreground">
                      {p.subtitle}
                    </span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <p className="mx-4 mt-4 mb-6 rounded-[var(--gh-radius-sm)] bg-emerald-50/80 px-3 py-2.5 text-[11px] leading-relaxed text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          <strong>GHC</strong> is GreenHaven&apos;s internal utility — earned through participation,
          never mixed with Pi. Pi powers verified external payments. Social identity (GH ID) stays
          separate from wallet balances.
        </p>
      </div>
    </div>
  )
}
