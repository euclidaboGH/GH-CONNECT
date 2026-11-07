import { NextResponse } from "next/server"
import { resolveAuthenticatedUser } from "@/lib/server/economy/auth"
import { checkDurableRateLimit, durableRateLimitStatus, durableRateLimitCode } from "@/lib/server/security/control-plane"
import { readBoundedJson } from "@/lib/server/http/read-bounded-json"
import { isValidPinFormat, isWeakPin } from "@/lib/server/identity/withdrawal-pin"
import { drawQuestionIds, getRecoveryStatus, questionsFor, resetPinWithAnswers, setupRecovery } from "@/lib/server/identity/pin-recovery"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" }
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })

/** GET — status; if not configured, returns a fresh random set of 3 questions to answer. */
export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const s = await getRecoveryStatus(auth.userId)
  if (!s.ok) return reply({ ok: false, error: s.error }, 503)
  if (!s.configured) return reply({ ok: true, configured: false, locked: false, questions: questionsFor(drawQuestionIds()) })
  return reply({ ok: true, configured: true, locked: s.locked, lockedUntil: s.lockedUntil || null, questions: s.questions })
}

/**
 * POST
 * - { action:"setup", answers:[{id, answer} x3] }   ids = the 3 returned by GET
 * - { action:"reset", answers:{ [id]: answer }, newPin, confirmPin }
 */
export async function POST(request: Request) {
  const auth = await resolveAuthenticatedUser(request.headers)
  if (!auth) return reply({ ok: false, error: "AUTH_REQUIRED" }, 401)
  const rl = await checkDurableRateLimit(`pin-recovery:${auth.userId}`, 10, 60_000, { onUnavailable: "deny" })
  if (!rl.ok) return reply({ ok: false, error: durableRateLimitCode(rl), retryAfterSec: rl.retryAfterSec }, durableRateLimitStatus(rl))
  const parsed = await readBoundedJson(request, 4 * 1024)
  if (!parsed.ok) return reply({ ok: false, error: parsed.error }, parsed.error === "REQUEST_TOO_LARGE" ? 413 : 400)
  const body = parsed.value as { action?: unknown; answers?: unknown; newPin?: unknown; confirmPin?: unknown }

  if (body.action === "setup") {
    const list = Array.isArray(body.answers) ? (body.answers as Array<{ id?: unknown; answer?: unknown }>) : []
    const r = await setupRecovery(auth.userId, list.map((a) => String(a?.id ?? "")), list.map((a) => a?.answer))
    if (!r.ok) return reply({ ok: false, error: r.error }, r.error === "RECOVERY_ALREADY_CONFIGURED" ? 409 : r.error === "RECOVERY_SERVICE_UNAVAILABLE" ? 503 : 400)
    return reply({ ok: true, configured: true })
  }
  if (body.action === "reset") {
    if (!isValidPinFormat(body.newPin) || body.newPin !== body.confirmPin || isWeakPin(body.newPin)) return reply({ ok: false, error: "PIN_FORMAT_INVALID", message: "Use a matching 6-digit PIN that is not a simple sequence or repeated digits." }, 400)
    const answers = body.answers && typeof body.answers === "object" && !Array.isArray(body.answers) ? (body.answers as Record<string, unknown>) : {}
    const r = await resetPinWithAnswers(auth.userId, answers, body.newPin)
    if (!r.ok) return reply({ ok: false, error: r.error }, r.error === "RECOVERY_LOCKED" ? 423 : r.error === "RECOVERY_ANSWERS_INCORRECT" ? 401 : r.error === "RECOVERY_NOT_CONFIGURED" || r.error === "PIN_NOT_CONFIGURED" ? 409 : 503)
    return reply({ ok: true, message: "Withdrawal PIN reset." })
  }
  return reply({ ok: false, error: "ACTION_REQUIRED" }, 400)
}
