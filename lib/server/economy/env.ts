/**
 * Server-only environment for GHC authority.
 * Never import this module from client components.
 * Privileged vars must NOT use NEXT_PUBLIC_ prefix.
 */

export type GhcServerEnv = {
  supabaseUrl: string | null
  supabaseServiceRoleKey: string | null
  databaseUrl: string | null
  /** Pi Platform API base for access-token verification */
  piPlatformApiUrl: string
  /** Optional HMAC/JWT secret for first-party tokens */
  authJwtSecret: string | null
  /** Allow Bearer user:<id> only when explicitly enabled (never production default) */
  allowDevAuth: boolean
  isProduction: boolean
}

export function readGhcServerEnv(): GhcServerEnv {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.GHC_ENV === "production"

  return {
    supabaseUrl:
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL || // URL is public; key is not
      null,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || null,
    databaseUrl: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || null,
    piPlatformApiUrl: (
      process.env.PI_PLATFORM_API_URL ||
      process.env.PI_API_URL ||
      "https://api.minepi.com"
    ).replace(/\/$/, ""),
    authJwtSecret: process.env.GHC_AUTH_JWT_SECRET || process.env.SUPABASE_JWT_SECRET || null,
    allowDevAuth:
      !isProduction &&
      (process.env.GHC_ALLOW_DEV_AUTH === "1" || process.env.NODE_ENV === "test"),
    isProduction,
  }
}

export function hasPrivilegedDatabase(env: GhcServerEnv = readGhcServerEnv()): boolean {
  return Boolean(
    (env.supabaseUrl && env.supabaseServiceRoleKey) || env.databaseUrl
  )
}

/** Required vars for production activation (report only — never invent values) */
export function requiredEnvChecklist(): Array<{ name: string; present: boolean; privileged: boolean }> {
  return [
    { name: "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL", present: Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL), privileged: false },
    { name: "SUPABASE_SERVICE_ROLE_KEY", present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY), privileged: true },
    { name: "DATABASE_URL (optional alternative)", present: Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL), privileged: true },
    { name: "PI_PLATFORM_API_URL (optional override)", present: Boolean(process.env.PI_PLATFORM_API_URL || process.env.PI_API_URL), privileged: false },
    { name: "GHC_AUTH_JWT_SECRET or SUPABASE_JWT_SECRET (optional first-party JWT)", present: Boolean(process.env.GHC_AUTH_JWT_SECRET || process.env.SUPABASE_JWT_SECRET), privileged: true },
  ]
}
