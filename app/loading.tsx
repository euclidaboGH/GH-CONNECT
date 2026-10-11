/** Root loading state shown while the app shell streams in. */
export default function Loading() {
  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background text-foreground"
      role="status"
      aria-live="polite"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" aria-hidden />
      <p className="text-sm text-muted-foreground">Loading GreenHaven…</p>
    </main>
  )
}
