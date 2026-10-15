/**
 * D7.1 — Shared GHC Wallet presentation helpers.
 * Display only. Never authoritative for balances or transfers.
 */

export type GhcUxErrorCode =
  | "INSUFFICIENT_BALANCE"
  | "INVALID_RECIPIENT"
  | "BLOCKED_USER"
  | "SELF_TRANSFER"
  | "TRANSFER_LIMIT_EXCEEDED"
  | "REQUEST_LIMIT_EXCEEDED"
  | "SERVER_UNAVAILABLE"
  | "AUTH_REQUIRED"
  | "NETWORK_TIMEOUT"
  | "TRANSFER_FAILED"
  | "REQUEST_EXPIRED"
  | "REQUEST_CLOSED"
  | "REQUEST_ALREADY_ACCEPTED"
  | "REQUEST_NOT_FOUND"
  | "REQUEST_NOT_AUTHORIZED"
  | "ACCOUNT_RESTRICTED"
  | "NETWORK_UNAVAILABLE"
  | "UNKNOWN"

export type GhcUxMessage = { title: string; body: string; next?: string }

const ERROR_MAP: Record<GhcUxErrorCode, GhcUxMessage> = {
  INSUFFICIENT_BALANCE: {
    title: "Insufficient balance",
    body: "You do not have enough available GHC for this amount.",
    next: "Lower the amount or wait for pending GHC to clear.",
  },
  INVALID_RECIPIENT: {
    title: "Recipient not found",
    body: "We could not identify that GreenHaven user.",
    next: "Check the GreenHaven ID or choose someone from your list.",
  },
  BLOCKED_USER: {
    title: "Not allowed",
    body: "Transfers are not available with this user.",
    next: "Choose a different recipient.",
  },
  SELF_TRANSFER: {
    title: "Invalid recipient",
    body: "You cannot send or request GHC with yourself.",
  },
  TRANSFER_LIMIT_EXCEEDED: {
    title: "Limit reached",
    body: "This amount exceeds your transfer or daily limit.",
    next: "Try a smaller amount or try again later.",
  },
  REQUEST_LIMIT_EXCEEDED: {
    title: "Request limit reached",
    body: "You have too many open requests or hit the daily request limit.",
    next: "Close older requests or try again tomorrow.",
  },
  SERVER_UNAVAILABLE: {
    title: "Unable to connect",
    body: "The wallet service is temporarily unavailable.",
    next: "Check your connection and try again. Do not assume the transfer failed until confirmed.",
  },
  AUTH_REQUIRED: {
    title: "Sign in required",
    body: "Authenticate to continue with GreenHaven Coin.",
  },
  NETWORK_TIMEOUT: {
    title: "Connection timed out",
    body: "We could not confirm the result yet.",
    next: "If you already confirmed, wait a moment and refresh activity. We will not create a second transfer automatically.",
  },
  TRANSFER_FAILED: {
    title: "Transfer failed",
    body: "The transfer could not be completed.",
    next: "Review the amount and recipient, then try again.",
  },
  REQUEST_EXPIRED: {
    title: "Request expired",
    body: "This request can no longer be paid.",
  },
  REQUEST_CLOSED: {
    title: "Request closed",
    body: "This request is no longer open for payment.",
  },
  REQUEST_ALREADY_ACCEPTED: {
    title: "Already paid",
    body: "This request was already accepted.",
    next: "Check your activity for the transfer.",
  },
  REQUEST_NOT_FOUND: {
    title: "Request not found",
    body: "This request is unavailable.",
  },
  REQUEST_NOT_AUTHORIZED: {
    title: "Not authorized",
    body: "You cannot perform this action on this request.",
  },
  ACCOUNT_RESTRICTED: {
    title: "Account restricted",
    body: "Transfers are temporarily restricted on this account.",
  },
  NETWORK_UNAVAILABLE: {
    title: "You are offline",
    body: "Connect to the internet to move GHC.",
  },
  UNKNOWN: {
    title: "Something went wrong",
    body: "Please try again.",
  },
}

/** Map raw domain/API codes or messages to user-safe copy. Never leaks SQL/stacks. */
export function mapGhcUxError(raw?: string | null): GhcUxMessage {
  if (!raw) return ERROR_MAP.UNKNOWN
  const s = String(raw).trim()
  const upper = s.toUpperCase()
  for (const code of Object.keys(ERROR_MAP) as GhcUxErrorCode[]) {
    if (upper === code || upper.includes(code)) {
      return ERROR_MAP[code]
    }
  }
  if (/timeout/i.test(s)) return ERROR_MAP.NETWORK_TIMEOUT
  if (/offline|network/i.test(s) && !/transfer/i.test(s)) return ERROR_MAP.NETWORK_UNAVAILABLE
  if (/insufficient|balance/i.test(s)) return ERROR_MAP.INSUFFICIENT_BALANCE
  if (/block/i.test(s)) return ERROR_MAP.BLOCKED_USER
  if (/self/i.test(s)) return ERROR_MAP.SELF_TRANSFER
  if (/auth|sign.?in|unauthor/i.test(s)) return ERROR_MAP.AUTH_REQUIRED
  if (/server|503|unavailable/i.test(s)) return ERROR_MAP.SERVER_UNAVAILABLE
  if (/limit/i.test(s)) return ERROR_MAP.TRANSFER_LIMIT_EXCEEDED
  if (/expir/i.test(s)) return ERROR_MAP.REQUEST_EXPIRED
  // Strip technical leakage
  if (/select |insert |sql|stack|exception|supabase|service.?role/i.test(s)) {
    return ERROR_MAP.UNKNOWN
  }
  return { title: ERROR_MAP.UNKNOWN.title, body: s.length < 120 ? s : ERROR_MAP.UNKNOWN.body }
}

/** Bank-style GHC amount — always two decimal places when finite */
export function formatGhcAmount(n: number, hidden = false): string {
  if (hidden) return "••••••"
  if (!Number.isFinite(n)) return "0.00"
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatGhcWhen(ts?: number | null): string {
  if (!ts) return "—"
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return "—"
  }
}

export type ActivityDirection = "in" | "out" | "neutral" | "pending"

export function activityDirection(kind: string, amount: number, status?: string): ActivityDirection {
  if (status === "pending" || kind === "pending") return "pending"
  if (kind === "transfer_in" || (amount > 0 && kind === "earned")) return "in"
  if (kind === "transfer_out" || amount < 0 || kind === "spent") return "out"
  if (amount > 0) return "in"
  if (amount < 0) return "out"
  return "neutral"
}

export function activityTitle(kind: string, status?: string): string {
  if (status === "pending") return "Pending"
  const map: Record<string, string> = {
    earned: "Activity credit",
    spent: "Spent",
    purchased: "Purchase",
    pending: "Pending",
    reversed: "Reversed",
    expired: "Expired",
    adjusted: "Adjustment",
    transfer_out: "Sent",
    transfer_in: "Received",
    transfer_request: "Request",
  }
  return map[kind] || kind
}

export function requestStatusLabel(status: string): string {
  const s = String(status || "").toUpperCase()
  const map: Record<string, string> = {
    PENDING: "Pending",
    ACCEPTED: "Accepted",
    DECLINED: "Declined",
    CANCELLED: "Cancelled",
    EXPIRED: "Expired",
  }
  return map[s] || status
}

/** Pending requests only may show Pay */
export function isRequestPayable(status: string, expiresAt?: number | null): boolean {
  if (String(status).toUpperCase() !== "PENDING") return false
  if (expiresAt != null && expiresAt > 0 && expiresAt < Date.now()) return false
  return true
}

export const EMPTY_STATES = {
  activity: {
    title: "No activity yet",
    body: "Complete a challenge in Rewards, or send / request GHC to see activity here.",
  },
  incomingRequests: {
    title: "No incoming requests",
    body: "You have no GHC requests waiting for payment.",
  },
  outgoingRequests: {
    title: "No outgoing requests",
    body: "You haven’t requested GHC from anyone yet.",
  },
  rewards: {
    title: "No rewards yet",
    body: "Complete your profile and contribute to unlock rewards.",
  },
} as const

export const PRIMARY_ACTIONS = [
  { id: "send" as const, label: "Send GHC", short: "Send" },
  { id: "request" as const, label: "Request GHC", short: "Request" },
  { id: "receive" as const, label: "Receive GHC", short: "Receive" },
]

export function maskBalanceText(visible: boolean, formatted: string): string {
  return visible ? formatted : "••••"
}

/** QR must never embed money or secrets — validate payload shape for display safety */
export function isSafeReceiveUri(uri: string): boolean {
  if (!uri || typeof uri !== "string") return false
  if (!uri.startsWith("ghc://receive?")) return false
  if (/token=|jwt=|secret=|balance=|amount=|key=/i.test(uri)) return false
  return /[?&]v=1/.test(uri) && /[?&]id=GH-[A-Z0-9]{6}/i.test(uri)
}
