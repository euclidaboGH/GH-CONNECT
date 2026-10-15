/** Root loading state shown while the app shell streams in. */
export default function Loading() {
  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background text-foreground"
      role="status"
      aria-live="polite"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-emerald-500 via-emerald-600 to-violet-600 shadow-[0_18px_45px_rgba(7,148,71,0.22)]" aria-hidden>
        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-white/40 border-t-white" />
      </div>
      <p className="text-base font-extrabold tracking-tight">GreenHaven</p>
      <p className="text-sm text-muted-foreground">Preparing your experience…</p>
    </main>
  )
}
