import { resolveE2eBaseUrl } from "../lib/e2e/resolve-base-url.mjs"

export default async function globalSetup() {
  const r = resolveE2eBaseUrl(process.env)
  if (!r.ok) {
    throw new Error(r.error)
  }
  console.log(`[e2e] baseURL=${r.baseUrl} local=${r.isLocal} prod=${r.isProdTarget}`)
}
