"use client"

import { usePiAuth } from "@/contexts/pi-auth-context"

export function AuthLoadingScreen() {
  const { authMessage, hasError, reinitialize, continueLocalPreview } = usePiAuth()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          {hasError ? (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
              <svg
                className="h-10 w-10 text-destructive"
                fill="none"
                strokeWidth="2"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
          ) : (
            <div className="relative" role="status" aria-label="Connecting">
              <div className="h-20 w-20 rounded-full border-4 border-primary/20" />
              <div className="absolute inset-0 h-20 w-20 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            {hasError ? "Couldn’t connect to Pi" : "Connecting to Pi Network"}
          </h2>
          <p
            className={`text-sm leading-relaxed ${
              hasError ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {authMessage}
          </p>
        </div>

        {hasError ? (
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => void reinitialize()}
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Retry authentication
            </button>
            <button
              type="button"
              onClick={continueLocalPreview}
              className="rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              Continue in local preview
            </button>
            <p className="max-w-xs text-center text-xs text-muted-foreground">
              Local preview works on Vercel and desktop browsers without the Pi
              app. Use Retry when you open GreenHaven inside Pi Browser.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            This usually takes a few seconds…
          </p>
        )}
      </div>
    </div>
  )
}
