import { test, expect } from "@playwright/test"
import { resolveE2eBaseUrl } from "../lib/e2e/resolve-base-url.mjs"

test("GHC_E2E_BASE_URL resolves for this run", () => {
  const r = resolveE2eBaseUrl(process.env)
  expect(r.ok, r.ok ? "" : r.error).toBeTruthy()
  if (r.ok) {
    expect(r.baseUrl).toMatch(/^https?:\/\//)
  }
})
