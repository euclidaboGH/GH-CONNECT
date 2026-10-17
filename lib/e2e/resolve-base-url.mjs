/**
 * Shared resolver for GHC_E2E_BASE_URL (test-only; never imported by app UI).
 */
export function resolveE2eBaseUrl(env = process.env) {
  const raw = String(env.GHC_E2E_BASE_URL || "").trim()
  if (!raw) {
    return {
      ok: false,
      error:
        "GHC_E2E_BASE_URL is not set.\n" +
        "  Local:   export GHC_E2E_BASE_URL=http://127.0.0.1:3000 && export GHC_E2E_ALLOW_LOCALHOST=1\n" +
        "  Preview: export GHC_E2E_BASE_URL=https://your-preview.vercel.app\n" +
        "  Prod smoke (opt-in): export GHC_E2E_BASE_URL=https://gh-connect-tau.vercel.app && export GHC_E2E_ALLOW_PRODUCTION=1",
    }
  }

  let url
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, error: `GHC_E2E_BASE_URL is not a valid URL: ${raw}` }
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: `GHC_E2E_BASE_URL must be http or https (got ${url.protocol})` }
  }

  const host = url.hostname.toLowerCase()
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local")

  if (isLocal && env.CI === "true" && env.GHC_E2E_ALLOW_LOCALHOST !== "1") {
    return {
      ok: false,
      error:
        "CI refused localhost E2E. Use a preview URL, or set GHC_E2E_ALLOW_LOCALHOST=1.",
    }
  }

  const knownProductionHosts = new Set(
    String(env.GHC_E2E_PRODUCTION_HOSTS || "gh-connect-tau.vercel.app")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  )
  const isProdTarget =
    env.GHC_E2E_TARGET === "production" || knownProductionHosts.has(host)

  if (isProdTarget && env.GHC_E2E_ALLOW_PRODUCTION !== "1") {
    return {
      ok: false,
      error:
        `Refusing production E2E against ${url.origin} without GHC_E2E_ALLOW_PRODUCTION=1.\n` +
        "  Prevents accidental production/Mainnet smoke from routine CI.",
    }
  }

  return {
    ok: true,
    baseUrl: url.origin,
    host,
    isLocal,
    isProdTarget,
  }
}

export function requireE2eBaseUrl(env = process.env) {
  const r = resolveE2eBaseUrl(env)
  if (!r.ok) {
    console.error(r.error)
    process.exit(2)
  }
  return r
}
