export type CreatorTipIdempotencyInput = {
  tipperId: string
  recipientId: string
  contentId?: string
  currency: "PI" | "GHC"
  amount: number
  clientKey?: string
}

export type CreatorTipIdempotencyResult =
  | { ok: true; key: string; clientScoped: boolean }
  | { ok: false; error: "INVALID_IDEMPOTENCY_KEY" }

/**
 * Idempotency is scoped to one user action. A reused client key recovers that action;
 * a fresh key allows a later tip to the same creator for the same amount.
 * The deterministic fallback preserves compatibility with older clients.
 */
export function buildCreatorTipIdempotencyKey(
  input: CreatorTipIdempotencyInput,
): CreatorTipIdempotencyResult {
  const clientKey = String(input.clientKey || "").trim()
  if (clientKey) {
    if (
      clientKey.length < 8 ||
      clientKey.length > 160 ||
      !/^[A-Za-z0-9._:-]+$/.test(clientKey)
    ) {
      return { ok: false, error: "INVALID_IDEMPOTENCY_KEY" }
    }
    return {
      ok: true,
      key: `tip:${input.tipperId}:request:${clientKey}`.slice(0, 200),
      clientScoped: true,
    }
  }

  const amount = input.amount.toFixed(input.currency === "GHC" ? 4 : 8)
  const key = input.contentId
    ? `tip:${input.tipperId}:post:${input.contentId}:${input.currency}:amt:${amount}`
    : `tip:${input.tipperId}:profile:${input.recipientId}:${input.currency}:amt:${amount}`
  return { ok: true, key: key.slice(0, 200), clientScoped: false }
}
