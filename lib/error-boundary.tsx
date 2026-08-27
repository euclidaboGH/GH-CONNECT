"use client"

import React, { type ReactNode } from "react"
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react"
import { toUserFacingError, logClientError } from "@/lib/user-facing-error"

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, retry: () => void) => ReactNode
  /** Optional label for logs / default UI */
  label?: string
  onRetry?: () => void
  onDismiss?: () => void
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  { hasError: boolean; error: Error | null; autoRetried: boolean }
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, autoRetried: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logClientError(this.props.label || "ErrorBoundary", error, {
      componentStack: errorInfo?.componentStack?.slice(0, 400),
    })
    // One soft auto-retry for transient first-paint / HMR / race issues
    if (!this.state.autoRetried) {
      const msg = (error?.message || "").toLowerCase()
      const transient =
        msg.includes("undefined") ||
        msg.includes("null") ||
        msg.includes("loading") ||
        msg.includes("chunk") ||
        msg.includes("dynamically imported")
      if (transient) {
        window.setTimeout(() => {
          this.setState({ hasError: false, error: null, autoRetried: true })
          try {
            this.props.onRetry?.()
          } catch {
            /* */
          }
        }, 120)
      }
    }
  }

  retry = () => {
    this.setState({ hasError: false, error: null, autoRetried: false })
    try {
      this.props.onRetry?.()
    } catch {
      /* */
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.retry)
      }

      const friendly = toUserFacingError(this.state.error)
      const section = this.props.label ? `${this.props.label} needs a refresh` : friendly.title

      return (
        <div
          className="flex min-h-[12rem] flex-col items-center justify-center gap-3 bg-background p-6 text-center"
          role="alert"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-950/40">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-lg font-bold text-foreground">{section}</h2>
          <p className="max-w-sm text-sm text-muted-foreground">{friendly.message}</p>
          <p className="text-[11px] text-muted-foreground">
            We kept your account safe. No progress or profile data was removed.
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={this.retry}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              <RefreshCw size={16} />
              Try again
            </button>
            {this.props.onDismiss && (
              <button
                type="button"
                onClick={this.props.onDismiss}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                <ArrowLeft size={16} />
                Dismiss
              </button>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/** Narrow boundary — one bad post must not blank the whole Feed */
export class PostErrorBoundary extends React.Component<
  { children: ReactNode; postId?: string },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; postId?: string }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: Error) {
    logClientError("PostErrorBoundary", error, { postId: this.props.postId })
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto my-2 max-w-lg rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-center dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            This post couldn&apos;t be shown
          </p>
          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-200/80">
            The rest of your feed is fine.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 text-xs font-bold text-emerald-700 underline dark:text-emerald-400"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
