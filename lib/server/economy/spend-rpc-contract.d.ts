declare module "./spend-rpc-contract.mjs" {
  export function parseGhcSpendRpcResult(
    value: unknown,
    expected: { amount?: number; referenceId?: string } | null | undefined
  ): { ok: false; error: string } | { ok: true; idempotent: boolean; transactionId: string; tx: unknown; amount: number }
}
