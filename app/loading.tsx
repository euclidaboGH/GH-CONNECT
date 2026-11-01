/** Root loading state shown while the authenticated app shell streams in. */
export default function Loading() {
  return (
    <main
      className="min-h-dvh bg-background px-4 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))] text-foreground sm:px-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading GreenHaven"
    >
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <header className="flex items-center gap-3 pt-2">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-900/10" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 4c-8 0-14 3.5-14 10a6 6 0 0 0 6 6c6.5 0 8-8 8-16Z" />
              <path d="M4 21c2.5-5 6-8 11-11" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-base font-extrabold tracking-tight">GreenHaven</p>
            <p className="text-xs text-muted-foreground">A greener space to connect and grow</p>
          </div>
          <span className="ml-auto flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" /> Loading
          </span>
        </header>

        <section className="rounded-[1.6rem] border border-border/70 bg-card p-4 shadow-sm" aria-hidden="true">
          <div className="flex items-center gap-3">
            <div className="gh-skeleton h-11 w-11 rounded-full bg-muted" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="gh-skeleton h-3 w-32 rounded-full bg-muted" />
              <div className="gh-skeleton h-2.5 w-20 rounded-full bg-muted" />
            </div>
            <div className="gh-skeleton h-8 w-20 rounded-full bg-muted" />
          </div>
          <div className="mt-5 flex gap-2">
            <div className="gh-skeleton h-9 flex-1 rounded-full bg-muted" />
            <div className="gh-skeleton h-9 flex-1 rounded-full bg-muted" />
            <div className="gh-skeleton h-9 flex-1 rounded-full bg-muted" />
          </div>
        </section>

        <section className="flex flex-col gap-4" aria-hidden="true">
          <div className="flex items-center justify-between">
            <div className="gh-skeleton h-4 w-28 rounded-full bg-muted" />
            <div className="gh-skeleton h-3 w-14 rounded-full bg-muted" />
          </div>
          {[0, 1].map((item) => (
            <article key={item} className="rounded-[1.6rem] border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="gh-skeleton h-10 w-10 rounded-full bg-muted" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="gh-skeleton h-3 w-28 rounded-full bg-muted" />
                  <div className="gh-skeleton h-2.5 w-16 rounded-full bg-muted" />
                </div>
                <div className="gh-skeleton h-5 w-5 rounded-full bg-muted" />
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <div className="gh-skeleton h-3 w-full rounded-full bg-muted" />
                <div className="gh-skeleton h-3 w-4/5 rounded-full bg-muted" />
              </div>
              <div className="gh-skeleton mt-4 aspect-[16/9] w-full rounded-2xl bg-muted" />
              <div className="mt-4 flex gap-4">
                <div className="gh-skeleton h-3 w-14 rounded-full bg-muted" />
                <div className="gh-skeleton h-3 w-14 rounded-full bg-muted" />
                <div className="gh-skeleton h-3 w-14 rounded-full bg-muted" />
              </div>
            </article>
          ))}
        </section>
        <p className="text-center text-xs text-muted-foreground">Preparing your experience…</p>
      </div>
    </main>
  )
}
