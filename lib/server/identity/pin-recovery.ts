/**
 * Withdrawal-PIN recovery via 3 randomly assigned security questions.
 * - Questions are drawn server-side with crypto.randomInt.
 * - Answers are normalized and stored only as per-answer scrypt hashes.
 * - Failed attempts are recorded atomically by a service-role-only RPC.
 * - PIN replacement and recovery-lock reset commit in one database transaction.
 */
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto"
import { readGhcServerEnv } from "@/lib/server/economy/env"

export const QUESTION_BANK: Record<string, string> = {
  birth_city: "In which town or city were you born?",
  best_food: "What is your favourite food?",
  first_school: "What was the name of your primary school?",
  childhood_friend: "What was your closest childhood friend's first name?",
  first_pet: "What was the name of your first pet?",
  mother_maiden: "What is your mother's maiden name?",
  first_job: "What was your first job?",
  favourite_teacher: "What was your favourite teacher's surname?",
  grandmother_name: "What is your grandmother's first name?",
  childhood_street: "What street did you grow up on?",
  favourite_song: "What is your all-time favourite song?",
  dream_destination: "Which country would you most like to visit?",
}

const MAX_ATTEMPTS = 5
const LOCK_SECONDS = 15 * 60
const QUESTION_COUNT = 3
const REQUEST_TIMEOUT_MS = 8_000

type StoredAnswer = { qid: string; salt: string; hash: string }
type RecoveryRow = { answers: StoredAnswer[]; failed_attempts: number; locked_until: string | null }
type RecoveryRpc = { ok?: boolean; error?: string; code?: unknown; configured?: boolean; answers?: unknown; failed_attempts?: number; locked_until?: string | null; locked?: boolean }

export function normalizeAnswer(raw: unknown): string {
  if (typeof raw !== "string") return ""
  return raw.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim()
}
export function isUsableAnswer(raw: unknown): boolean {
  const n = normalizeAnswer(raw)
  return n.length >= 2 && n.length <= 80
}
/** Draw 3 distinct questions (Fisher–Yates with cryptographic randomness). */
export function drawQuestionIds(): string[] {
  const ids = Object.keys(QUESTION_BANK)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1)
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids.slice(0, QUESTION_COUNT)
}
export function questionsFor(ids: string[]) {
  return ids.map((id) => ({ id, text: QUESTION_BANK[id] })).filter((q) => !!q.text)
}

const hash = (value: string, saltHex: string) =>
  scryptSync(value, Buffer.from(saltHex, "hex"), 32).toString("hex")

function isStoredAnswer(value: unknown): value is StoredAnswer {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return typeof item.qid === "string" && !!QUESTION_BANK[item.qid]
    && typeof item.salt === "string" && /^[0-9a-f]{32}$/.test(item.salt)
    && typeof item.hash === "string" && /^[0-9a-f]{64}$/.test(item.hash)
}

async function recoveryRpc(name: string, body: Record<string, unknown>): Promise<{ ok: true; data: RecoveryRpc } | { ok: false; error: string }> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false, error: "RECOVERY_SERVICE_UNAVAILABLE" }
  try {
    const response = await fetch(`${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: env.supabaseServiceRoleKey,
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const data = (await response.json().catch(() => null)) as RecoveryRpc | null
    if (!response.ok) {
      const code = typeof data?.error === "string" ? data.error : typeof data?.code === "string" ? data.code : undefined
      // Keep the diagnostic actionable without logging user data, answers, hashes, or credentials.
      console.error("[pin-recovery] Supabase RPC failed", { operation: name, status: response.status, code })
      return { ok: false, error: response.status === 403 ? "RECOVERY_STORAGE_PERMISSION_DENIED" : "RECOVERY_SERVICE_UNAVAILABLE" }
    }
    if (!data || typeof data !== "object") return { ok: false, error: "RECOVERY_SERVICE_UNAVAILABLE" }
    return { ok: true, data }
  } catch (error) {
    console.error("[pin-recovery] Supabase RPC unavailable", {
      operation: name,
      cause: error instanceof Error ? error.name : "unknown",
    })
    return { ok: false, error: "RECOVERY_SERVICE_UNAVAILABLE" }
  }
}

async function loadRow(userId: string): Promise<{ ok: true; row: RecoveryRow | null } | { ok: false; error: string }> {
  const result = await recoveryRpc("gh_withdrawal_pin_recovery_get", { p_user_id: userId })
  if (!result.ok) return result
  if (result.data.ok !== true) return { ok: false, error: result.data.error || "RECOVERY_SERVICE_UNAVAILABLE" }
  if (result.data.configured !== true) return { ok: true, row: null }
  const answers = result.data.answers
  if (!Array.isArray(answers) || answers.length !== QUESTION_COUNT || !answers.every(isStoredAnswer)) {
    console.error("[pin-recovery] stored recovery record failed schema validation")
    return { ok: false, error: "RECOVERY_DATA_INVALID" }
  }
  return {
    ok: true,
    row: {
      answers,
      failed_attempts: Number.isFinite(Number(result.data.failed_attempts)) ? Number(result.data.failed_attempts) : 0,
      locked_until: typeof result.data.locked_until === "string" ? result.data.locked_until : null,
    },
  }
}

export async function getRecoveryStatus(userId: string) {
  const result = await loadRow(userId)
  if (!result.ok) return result
  if (!result.row) return { ok: true as const, configured: false, locked: false }
  const locked = !!result.row.locked_until && new Date(result.row.locked_until).getTime() > Date.now()
  return {
    ok: true as const,
    configured: true,
    locked,
    lockedUntil: result.row.locked_until,
    questions: questionsFor(result.row.answers.map((answer) => answer.qid)),
  }
}

/** Insert-only setup: the database prevents overwriting an existing recovery record. */
export async function setupRecovery(userId: string, questionIds: string[], answers: unknown[]) {
  if (questionIds.length !== QUESTION_COUNT || new Set(questionIds).size !== QUESTION_COUNT
      || questionIds.some((questionId) => !QUESTION_BANK[questionId]) || answers.length !== QUESTION_COUNT
      || !answers.every(isUsableAnswer)) return { ok: false as const, error: "RECOVERY_INPUT_INVALID" }
  const normalized = answers.map(normalizeAnswer)
  if (new Set(normalized).size !== QUESTION_COUNT) return { ok: false as const, error: "RECOVERY_ANSWERS_MUST_DIFFER" }
  const stored: StoredAnswer[] = questionIds.map((qid, index) => {
    const salt = randomBytes(16).toString("hex")
    return { qid, salt, hash: hash(normalized[index], salt) }
  })
  const result = await recoveryRpc("gh_withdrawal_pin_recovery_setup", { p_user_id: userId, p_answers: stored })
  if (!result.ok) return result
  if (result.data.ok === true) return { ok: true as const }
  return { ok: false as const, error: result.data.error || "RECOVERY_PERSIST_FAILED" }
}

/** Verify all answers; failed-attempt increments and successful PIN replacement are database-atomic. */
export async function resetPinWithAnswers(userId: string, answersByQid: Record<string, unknown>, newPin: string) {
  const result = await loadRow(userId)
  if (!result.ok) return result
  if (!result.row) return { ok: false as const, error: "RECOVERY_NOT_CONFIGURED" }
  if (result.row.locked_until && new Date(result.row.locked_until).getTime() > Date.now()) {
    return { ok: false as const, error: "RECOVERY_LOCKED" }
  }

  let allCorrect = true
  for (const answer of result.row.answers) {
    const given = normalizeAnswer(answersByQid[answer.qid])
    const actual = Buffer.from(hash(given, answer.salt), "hex")
    const expected = Buffer.from(answer.hash, "hex")
    const matches = given.length > 0 && actual.length === expected.length && timingSafeEqual(actual, expected)
    allCorrect = matches && allCorrect
  }

  if (!allCorrect) {
    const failure = await recoveryRpc("gh_withdrawal_pin_recovery_record_failure", {
      p_user_id: userId, p_max_attempts: MAX_ATTEMPTS, p_lock_seconds: LOCK_SECONDS,
    })
    if (!failure.ok) return failure
    if (failure.data.ok !== true) return { ok: false as const, error: failure.data.error || "RECOVERY_SERVICE_UNAVAILABLE" }
    return { ok: false as const, error: failure.data.locked === true ? "RECOVERY_LOCKED" : "RECOVERY_ANSWERS_INCORRECT" }
  }

  const salt = randomBytes(16).toString("hex")
  const reset = await recoveryRpc("gh_withdrawal_pin_recovery_reset_pin", {
    p_user_id: userId,
    p_pin_hash: hash(newPin, salt),
    p_pin_salt: salt,
  })
  if (!reset.ok) return reset
  if (reset.data.ok !== true) return { ok: false as const, error: reset.data.error || "RECOVERY_SERVICE_UNAVAILABLE" }
  return { ok: true as const }
}
