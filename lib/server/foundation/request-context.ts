/**
 * Request correlation for server routes.
 * Does not replace auth — attach IDs to responses/logs only.
 */
import { randomBytes } from "crypto"

const HEADER_CANDIDATES = [
  "x-request-id",
  "x-correlation-id",
  "x-vercel-id",
] as const

export type RequestContext = {
  requestId: string
  /** Milliseconds since epoch when context was created */
  startedAt: number
}

/** Resolve or mint a request id from incoming headers. */
export function getRequestContext(headers: Headers): RequestContext {
  let requestId = ""
  for (const h of HEADER_CANDIDATES) {
    const v = headers.get(h)?.trim()
    if (v && v.length <= 128 && /^[\w.:\-]+$/.test(v)) {
      requestId = v
      break
    }
  }
  if (!requestId) {
    requestId = `gh_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`
  }
  return { requestId, startedAt: Date.now() }
}

export function requestIdHeaders(ctx: RequestContext): Record<string, string> {
  return { "x-request-id": ctx.requestId }
}
