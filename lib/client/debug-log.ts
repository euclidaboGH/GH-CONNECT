/**
 * Dev-oriented logging that stays quiet in production builds.
 * Never logs secrets, tokens, or full PII.
 */
const ENABLED =
  typeof process !== "undefined" &&
  process.env.NODE_ENV !== "production"

export function debugLog(scope: string, ...args: unknown[]): void {
  if (!ENABLED) return
  try {
    console.log(`[${scope}]`, ...args)
  } catch { /* */ }
}

export function debugWarn(scope: string, ...args: unknown[]): void {
  if (!ENABLED) return
  try {
    console.warn(`[${scope}]`, ...args)
  } catch { /* */ }
}

export function debugError(scope: string, ...args: unknown[]): void {
  // Errors remain visible in production for operator diagnosis, but never throw.
  try {
    console.error(`[${scope}]`, ...args)
  } catch { /* */ }
}
