/**
 * GHC P2P transfer HTTP/repository contract (Phase B).
 *
 * Local/Studio: ledger in ghc_economy_ledger_v1 — not security authority.
 * Server mode: ONE atomic operation POST /economy/transfers.
 * Client must NEVER post a standalone transfer_in as an authoritative credit.
 *
 * Future server MUST:
 * - Authenticate caller; derive senderId from session (ignore client senderId)
 * - Verify recipient, blocks, limits, available balance server-side
 * - Enforce idempotency on referenceId
 * - Atomically write transfer_out + transfer_in with the same referenceId
 * - Never trust client-provided balances, earned totals, or pre-built credit txs
 */

import type { GhcTransaction, GhcWalletSnapshot } from "./economy-types"

/** Persistence mode for the economy repository */
export type EconomyPersistenceMode = "local" | "server"

/**
 * Client → server transfer intent only (no client-authored credit leg).
 * Sender is always the authenticated principal on the server.
 */
export interface GhcTransferIntent {
  /** Recipient user id */
  toUserId: string
  /** Display name for ledger reason text (non-authoritative) */
  toUserName?: string
  /** Positive GHC amount */
  amount: number
  /** Optional user note (capped by domain) */
  note?: string
  /**
   * Stable idempotency key. Retries MUST reuse the same value.
   * Never mint a new reference solely because a previous call timed out.
   */
  referenceId: string
  /** When paying a transfer request */
  requestId?: string
}

export interface GhcTransferRequestIntent {
  fromUserId: string
  fromUserName?: string
  amount: number
  note?: string
  referenceId: string
}

/** Typed machine codes — safe to map to UI without leaking internals */
export type GhcTransferErrorCode =
  | "INSUFFICIENT_BALANCE"
  | "INVALID_AMOUNT"
  | "INVALID_RECIPIENT"
  | "SELF_TRANSFER"
  | "BLOCKED_USER"
  | "ACCOUNT_RESTRICTED"
  | "TRANSFER_LIMIT_EXCEEDED"
  | "REQUEST_LIMIT_EXCEEDED"
  | "DUPLICATE_TRANSACTION"
  | "AUTH_REQUIRED"
  | "SERVER_UNAVAILABLE"
  | "TRANSFER_FAILED"
  | "REQUEST_NOT_FOUND"
  | "REQUEST_CLOSED"
  | "NETWORK_TIMEOUT"
  | "HYDRATION_FAILED"

export interface GhcTransferError {
  code: GhcTransferErrorCode
  /** User-safe message */
  message: string
  /** Dev-only detail — never show raw to end users */
  debug?: string
}

export interface GhcTransferSuccess {
  ok: true
  /** true when server returned an existing transfer for this referenceId */
  idempotent?: boolean
  referenceId: string
  debitTx: GhcTransaction
  creditTx: GhcTransaction
  /** Optional wallet snapshot for the authenticated user after transfer */
  wallet?: GhcWalletSnapshot
}

export interface GhcTransferFailure {
  ok: false
  error: GhcTransferError
}

export type GhcTransferResult = GhcTransferSuccess | GhcTransferFailure

/** Map domain/HTTP failures to stable codes without exposing SQL/stack traces */
export function mapTransferFailure(
  raw: string | undefined | null,
  fallback: GhcTransferErrorCode = "TRANSFER_FAILED"
): GhcTransferError {
  const text = String(raw || "").trim()
  const lower = text.toLowerCase()
  const code: GhcTransferErrorCode =
    lower.includes("insufficient") || lower.includes("pending reward")
      ? "INSUFFICIENT_BALANCE"
      : lower.includes("self")
        ? "SELF_TRANSFER"
        : lower.includes("block")
          ? "BLOCKED_USER"
          : lower.includes("restrict") || lower.includes("suspend")
            ? "ACCOUNT_RESTRICTED"
            : lower.includes("not found") || lower.includes("recipient")
              ? "INVALID_RECIPIENT"
              : lower.includes("auth") || lower.includes("unauthor")
                ? "AUTH_REQUIRED"
                : lower.includes("limit") && lower.includes("request")
                  ? "REQUEST_LIMIT_EXCEEDED"
                  : lower.includes("limit")
                    ? "TRANSFER_LIMIT_EXCEEDED"
                    : lower.includes("duplicate") || lower.includes("idempot")
                      ? "DUPLICATE_TRANSACTION"
                      : lower.includes("timeout") || lower.includes("network")
                        ? "NETWORK_TIMEOUT"
                        : lower.includes("unavailable") || lower.includes("503")
                          ? "SERVER_UNAVAILABLE"
                          : lower.includes("amount") || lower.includes("minimum") || lower.includes("maximum")
                            ? "INVALID_AMOUNT"
                            : lower.includes("request") && (lower.includes("closed") || lower.includes("expired") || lower.includes("declin") || lower.includes("cancel"))
                              ? "REQUEST_CLOSED"
                              : fallback

  const message =
    code === "INSUFFICIENT_BALANCE"
      ? "Not enough available GHC. Pending rewards cannot be transferred."
      : code === "SELF_TRANSFER"
        ? "You cannot send GHC to yourself."
        : code === "BLOCKED_USER"
          ? "Transfers are not allowed with this user."
          : code === "ACCOUNT_RESTRICTED"
            ? "This account cannot send or request GHC right now."
            : code === "INVALID_RECIPIENT"
              ? "Recipient could not be found."
              : code === "INVALID_AMOUNT"
                ? "Enter a valid transfer amount."
                : code === "TRANSFER_LIMIT_EXCEEDED"
                  ? "Transfer limit reached. Try a smaller amount or wait."
                  : code === "REQUEST_LIMIT_EXCEEDED"
                    ? "Request limit reached."
                    : code === "AUTH_REQUIRED"
                      ? "Sign in to transfer GHC."
                      : code === "SERVER_UNAVAILABLE"
                        ? "Transfer service is temporarily unavailable."
                      : code === "NETWORK_TIMEOUT"
                        ? "Network timed out. Reconcile this transfer before retrying."
                        : code === "DUPLICATE_TRANSACTION"
                          ? "This transfer was already processed."
                          : "Transfer could not be completed."

  return {
    code,
    message,
    debug: text && text !== message ? text.slice(0, 200) : undefined,
  }
}

/** Request body for POST /economy/transfers — intent only */
export function toTransferHttpBody(intent: GhcTransferIntent): Record<string, unknown> {
  return {
    toUserId: intent.toUserId,
    toUserName: intent.toUserName,
    amount: intent.amount,
    note: intent.note,
    referenceId: intent.referenceId,
    requestId: intent.requestId,
  }
}
