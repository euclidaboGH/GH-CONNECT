/** Server-only endpoint fingerprinting; keep Node crypto out of shared contracts. */
import { createHash } from "node:crypto"

export function hashPushEndpoint(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex")
}
