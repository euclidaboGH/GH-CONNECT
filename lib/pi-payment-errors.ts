/**
 * Humanize Pi payment / approve failures for calm, actionable UX.
 * Avoid blame; separate temporary vs config vs hard failures.
 *
 * Research: UPI/fintech retry playbooks — “Bank could not confirm” > “Payment failed”;
 * one-tap retry; don’t imply double-charge on soft fails.
 */

export type PaymentFailureKind =
  | "not_in_pi_browser"
  | "sdk_not_ready"
  | "approve_timeout"
  | "approve_config"
  | "network"
  | "cancelled"
  | "auth"
  | "unknown"

export type HumanPaymentError = {
  kind: PaymentFailureKind
  title: string
  body: string
  /** User-facing next step */
  actionHint: string
  retryable: boolean
}

export function classifyPaymentError(raw: string | null | undefined): HumanPaymentError {
  const msg = String(raw || "").toLowerCase()

  if (!msg || msg.includes("cancel")) {
    return {
      kind: "cancelled",
      title: "Payment cancelled",
      body: "No charge was completed. You can try again when you’re ready.",
      actionHint: "Tap retry to start a new payment.",
      retryable: true,
    }
  }

  if (
    msg.includes("pi browser") ||
    msg.includes("need the pi browser") ||
    msg.includes("not chrome")
  ) {
    return {
      kind: "not_in_pi_browser",
      title: "Open in Pi Browser",
      body: "Pi payments only work inside the Pi Browser app — not Chrome or Safari.",
      actionHint: "Open this same link from Pi Browser, then retry.",
      retryable: true,
    }
  }

  if (
    msg.includes("not ready") ||
    msg.includes("connecting to pi") ||
    msg.includes("payments are not ready")
  ) {
    return {
      kind: "sdk_not_ready",
      title: "Pi is still connecting",
      body: "The payment bridge needs a moment after the app opens.",
      actionHint: "Wait a few seconds, then retry.",
      retryable: true,
    }
  }

  if (
    msg.includes("expired") ||
    msg.includes("timeout") ||
    msg.includes("60s") ||
    msg.includes("approve ultimately")
  ) {
    return {
      kind: "approve_timeout",
      title: "Payment timed out",
      body: "The wallet closed before the server could confirm the payment with Pi.",
      actionHint: "Retry once. If it keeps happening, check that API keys match sandbox/mainnet.",
      retryable: true,
    }
  }

  if (
    msg.includes("pi_api_key") ||
    msg.includes("503") ||
    msg.includes("sandbox") ||
    msg.includes("mainnet") ||
    msg.includes("developer approve")
  ) {
    return {
      kind: "approve_config",
      title: "Payment could not be confirmed",
      body: "The app could not complete the server approval step with Pi.",
      actionHint:
        "This is usually a configuration issue (API key or network mode). Retry after the operator checks /api/payments/health.",
      retryable: true,
    }
  }

  if (msg.includes("401") || msg.includes("403") || msg.includes("authorization") || msg.includes("session")) {
    return {
      kind: "auth",
      title: "Session needs a refresh",
      body: "Your GreenHaven session may have expired for payments.",
      actionHint: "Unlock or sign in with Pi, then retry the payment.",
      retryable: true,
    }
  }

  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to")) {
    return {
      kind: "network",
      title: "Connection issue",
      body: "We couldn’t reach the payment service. Your balance was not charged if the payment didn’t complete.",
      actionHint: "Check your connection and retry.",
      retryable: true,
    }
  }

  return {
    kind: "unknown",
    title: "Payment didn’t complete",
    body: raw?.trim() || "Something went wrong while processing the payment.",
    actionHint: "You can retry. No completed charge means no Pi left your wallet.",
    retryable: true,
  }
}
