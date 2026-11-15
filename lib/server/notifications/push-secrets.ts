import { createCipheriv, createDecipheriv, createECDH, randomBytes, timingSafeEqual } from "node:crypto"

const ENCRYPTION_VERSION = "v1"
const ENCRYPTION_AAD = Buffer.from("greenhaven:web-push-subscription:v1", "utf8")

function decodeBase64Url(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null
  try { return Buffer.from(value, "base64url") } catch { return null }
}

function subscriptionEncryptionKey(): Buffer | null {
  const encoded = process.env.WEB_PUSH_SUBSCRIPTION_ENCRYPTION_KEY || ""
  const key = decodeBase64Url(encoded)
  return key?.length === 32 ? key : null
}

export function hasPushSubscriptionEncryptionKey(): boolean {
  return subscriptionEncryptionKey() !== null
}

/** Encrypts subscription secrets before they cross the application/database boundary. */
export function encryptPushSecret(plaintext: string): string {
  const key = subscriptionEncryptionKey()
  if (!key) throw new Error("PUSH_SUBSCRIPTION_ENCRYPTION_KEY_INVALID")
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  cipher.setAAD(ENCRYPTION_AAD)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [ENCRYPTION_VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".")
}

/** Decrypts only inside the trusted server worker; never return plaintext to a browser. */
export function decryptPushSecret(envelope: string): string {
  const key = subscriptionEncryptionKey()
  if (!key) throw new Error("PUSH_SUBSCRIPTION_ENCRYPTION_KEY_INVALID")
  const parts = envelope.split(".")
  if (parts.length !== 4 || parts[0] !== ENCRYPTION_VERSION) throw new Error("PUSH_SECRET_ENVELOPE_INVALID")
  const iv = decodeBase64Url(parts[1])
  const tag = decodeBase64Url(parts[2])
  const ciphertext = decodeBase64Url(parts[3])
  if (!iv || iv.length !== 12 || !tag || tag.length !== 16 || !ciphertext || ciphertext.length > 8192) {
    throw new Error("PUSH_SECRET_ENVELOPE_INVALID")
  }
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAAD(ENCRYPTION_AAD)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}

export function validateVapidConfiguration(publicKeyValue: string, privateKeyValue: string, subjectValue: string) {
  const publicBytes = decodeBase64Url(publicKeyValue)
  const privateBytes = decodeBase64Url(privateKeyValue)
  const subjectValid = (() => {
    if (/^mailto:[^\s@]+@[^\s@]+$/.test(subjectValue)) return true
    try {
      const url = new URL(subjectValue)
      return url.protocol === "https:" && !url.username && !url.password && !url.hash
    } catch { return false }
  })()
  if (!publicBytes || publicBytes.length !== 65 || publicBytes[0] !== 4 || !privateBytes || privateBytes.length !== 32 || !subjectValid) {
    return { valid: false, publicKey: null as string | null, reason: "VAPID_FORMAT_INVALID" }
  }
  try {
    const ecdh = createECDH("prime256v1")
    ecdh.setPrivateKey(privateBytes)
    const derivedPublic = ecdh.getPublicKey(undefined, "uncompressed")
    if (derivedPublic.length !== publicBytes.length || !timingSafeEqual(derivedPublic, publicBytes)) {
      return { valid: false, publicKey: null, reason: "VAPID_KEYPAIR_MISMATCH" }
    }
    return { valid: true, publicKey: publicKeyValue, reason: null }
  } catch {
    return { valid: false, publicKey: null, reason: "VAPID_KEYPAIR_INVALID" }
  }
}

/** Generate a key only in a trusted operator environment; never expose private material to clients. */
export function generatePushEncryptionKeyForOperator(): string {
  return randomBytes(32).toString("base64url")
}
