/**
 * GreenHaven ID — universal GreenHaven identity (GH-XXXXXX)
 * Share · Copy · QR · Scan · Find · Send GHC · Open profile
 */
export { GreenHavenIdentityCard } from "@/components/ghc/greenhaven-identity-card"
export {
  getOrCreateGreenHavenId,
  deriveGreenHavenId,
  formatGreenHavenIdDisplay,
  isValidGreenHavenIdFormat,
  normalizeGreenHavenId,
  resolveUserIdFromGreenHavenId,
  GH_ID_REGEX,
} from "@/lib/domains/greenhaven-id"
export { buildReceivePayload, parseReceivePayload } from "@/lib/domains/ghc-receive-payload"

export { GhIdentityQr, buildIdentityOnlyQrPayload } from "@/components/ghc/gh-identity-qr"
