/**
 * Pi wallet consent verification (server-only, dependency-injectable).
 *
 * A wallet authorization may be recorded only when ALL of these hold:
 *  1. the caller is an authenticated GreenHaven account (server-side user id),
 *  2. the request carries explicit consent (`consent === true`),
 *  3. the request carries a fresh Pi accessToken that the Pi Platform verifies
 *     (/v2/me) — the Pi UID is NEVER taken from the browser,
 *  4. the verified Pi UID equals the durable gh_pi_identities mapping of that
 *     same GreenHaven account (and that UID maps back to that account).
 *
 * Nothing here stores or logs the access token.
 */

export type WalletConsentFailure =
  | "CONSENT_REQUIRED"
  | "PI_TOKEN_REQUIRED"
  | "PI_TOKEN_INVALID"
  | "IDENTITY_MAPPING_REQUIRED"
  | "IDENTITY_MISMATCH"
  | "IDENTITY_LOOKUP_UNAVAILABLE"
  | "PI_WALLET_ADDRESS_REQUIRED"
  | "PI_WALLET_ADDRESS_UNVERIFIED"
  | "PI_WALLET_ADDRESS_INVALID"
  | "PI_WALLET_ADDRESS_MISMATCH"

export type WalletConsentVerification =
  | { ok: true; piAppUid: string; piUsername: string | null; piWalletAddress: string; walletAddressSource: "platform_api" }
  | { ok: false; error: WalletConsentFailure }

export type WalletConsentDeps = {
  verifyPiAccessToken: (token: string) => Promise<{ uid: string; username?: string; walletAddress?: string } | null>
  getByGhUserId: (ghUserId: string) => Promise<{ ghUserId: string; piAppUid: string; piUsername?: string | null } | null>
  getByPiAppUid: (piAppUid: string) => Promise<{ ghUserId: string; piAppUid: string } | null>
}

const MAX_TOKEN_LENGTH = 4096

export async function verifyWalletConsentProof(
  input: { ghUserId: string; accessToken: unknown; consent: unknown; walletAddress: unknown },
  deps: WalletConsentDeps,
): Promise<WalletConsentVerification> {
  // Explicit consent must be the literal boolean true — never truthy strings.
  if (input.consent !== true) return { ok: false, error: "CONSENT_REQUIRED" }

  // The SDK value is used only as a consistency check. It is browser-controlled
  // request data and MUST NEVER become the stored payout destination by itself.
  const sdkWalletAddress = typeof input.walletAddress === "string" ? input.walletAddress.trim().toUpperCase() : ""
  if (sdkWalletAddress && !/^G[A-Z2-7]{55}$/.test(sdkWalletAddress)) {
    return { ok: false, error: "PI_WALLET_ADDRESS_INVALID" }
  }

  const token = typeof input.accessToken === "string" ? input.accessToken.trim() : ""
  if (!token || token.length > MAX_TOKEN_LENGTH) return { ok: false, error: "PI_TOKEN_REQUIRED" }

  const ghUserId = String(input.ghUserId || "").trim()
  if (!ghUserId) return { ok: false, error: "IDENTITY_MAPPING_REQUIRED" }

  // Trusted server-side verification with the Pi Platform.
  const piUser = await deps.verifyPiAccessToken(token)
  if (!piUser || typeof piUser !== "object") return { ok: false, error: "PI_TOKEN_INVALID" }
  const verifiedPiUid = typeof piUser?.uid === "string" ? piUser.uid.trim() : ""
  if (!verifiedPiUid || verifiedPiUid.length > 160) return { ok: false, error: "PI_TOKEN_INVALID" }

  let mapping: Awaited<ReturnType<WalletConsentDeps["getByGhUserId"]>>
  let reverse: Awaited<ReturnType<WalletConsentDeps["getByPiAppUid"]>>
  try {
    mapping = await deps.getByGhUserId(ghUserId)
    if (!mapping?.piAppUid) return { ok: false, error: "IDENTITY_MAPPING_REQUIRED" }
    reverse = await deps.getByPiAppUid(verifiedPiUid)
  } catch {
    return { ok: false, error: "IDENTITY_LOOKUP_UNAVAILABLE" }
  }

  // The verified Pi account must be the one already linked to THIS GH account…
  if (mapping.ghUserId !== ghUserId || mapping.piAppUid !== verifiedPiUid) return { ok: false, error: "IDENTITY_MISMATCH" }
  // …and that Pi UID must resolve back to the same GH account (no cross-account authorization).
  if (!reverse || reverse.ghUserId !== ghUserId || reverse.piAppUid !== verifiedPiUid) return { ok: false, error: "IDENTITY_MISMATCH" }

  // Only /v2/me can attest the wallet address server-side. The SDK field is
  // untrusted request data and is compared when present, never used as fallback.
  const platformWalletAddress = String(piUser.walletAddress || "").trim().toUpperCase()
  if (platformWalletAddress && !/^G[A-Z2-7]{55}$/.test(platformWalletAddress)) {
    return { ok: false, error: "PI_WALLET_ADDRESS_INVALID" }
  }
  if (platformWalletAddress && sdkWalletAddress && platformWalletAddress !== sdkWalletAddress) {
    return { ok: false, error: "PI_WALLET_ADDRESS_MISMATCH" }
  }
  if (!platformWalletAddress) {
    return { ok: false, error: sdkWalletAddress ? "PI_WALLET_ADDRESS_UNVERIFIED" : "PI_WALLET_ADDRESS_REQUIRED" }
  }
  const piWalletAddress = platformWalletAddress
  const walletAddressSource = "platform_api" as const

  return {
    ok: true,
    piAppUid: mapping.piAppUid,
    piUsername: mapping.piUsername ?? piUser.username ?? null,
    piWalletAddress,
    walletAddressSource,
  }
}

/** Safe user-facing copy for each failure; never includes tokens or internals. */
export const WALLET_CONSENT_MESSAGES: Record<WalletConsentFailure, string> = {
  CONSENT_REQUIRED: "Please confirm the consent checkbox to authorize your Pi wallet.",
  PI_TOKEN_REQUIRED: "Pi authentication is required. Please retry Pi authentication.",
  PI_TOKEN_INVALID: "Pi authentication could not be verified. Please retry Pi authentication.",
  IDENTITY_MAPPING_REQUIRED: "Sign in with Pi so GreenHaven can link your Pi identity before authorizing withdrawals.",
  IDENTITY_MISMATCH: "Your authenticated Pi account does not match the Pi account linked to this GreenHaven account.",
  IDENTITY_LOOKUP_UNAVAILABLE: "Identity verification is temporarily unavailable. Withdrawals remain blocked; please try again shortly.",
  PI_WALLET_ADDRESS_REQUIRED: "Pi did not return a wallet address for this account. No authorization or withdrawal was created. Reopen the registered GreenHaven app in Pi Browser and approve wallet-address access. If Pi does not prompt, confirm wallet_address is enabled for GreenHaven in the Pi Developer Portal.",
  PI_WALLET_ADDRESS_UNVERIFIED: "Pi returned a wallet address in the browser, but the Pi Platform did not independently verify it. GreenHaven cannot safely authorize withdrawals yet. Check that wallet_address permission is enabled for this app in the Pi Developer Portal, then retry in Pi Browser. Never enter an address manually.",
  PI_WALLET_ADDRESS_INVALID: "Pi returned an invalid wallet address. No payout authorization was changed.",
  PI_WALLET_ADDRESS_MISMATCH: "The wallet address from Pi authentication did not match Pi's server response. No payout authorization was changed.",
}

export function walletConsentFailureStatus(error: WalletConsentFailure): number {
  switch (error) {
    case "CONSENT_REQUIRED":
    case "PI_TOKEN_REQUIRED":
      return 400
    case "PI_TOKEN_INVALID":
      return 401
    case "IDENTITY_MISMATCH":
      return 403
    case "IDENTITY_MAPPING_REQUIRED":
      return 409
    case "IDENTITY_LOOKUP_UNAVAILABLE":
      return 503
    case "PI_WALLET_ADDRESS_REQUIRED":
    case "PI_WALLET_ADDRESS_UNVERIFIED":
    case "PI_WALLET_ADDRESS_MISMATCH":
      return 409
    case "PI_WALLET_ADDRESS_INVALID":
      return 422
  }
}
