/**
 * Withdrawal-PIN recovery via 3 randomly assigned security questions.
 * - Questions are drawn server-side with crypto.randomInt, so different users get different sets.
 * - Answers are normalized then stored only as per-answer scrypt hashes.
 * - 5 wrong attempts lock recovery for 15 minutes. All 3 answers must match.
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
const LOCK_MS = 15 * 60_000
const QUESTION_COUNT = 3

export function normalizeAnswer(raw: unknown): string {
  if (typeof raw !== "string") return ""
  return raw.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim()
}
export function isUsableAnswer(raw: unknown): boolean {
  const n = normalizeAnswer(raw)
  return n.length >= 2 && n.length <= 80
}
/** Draw 3 distinct questions at random (Fisher–Yates with crypto randomness). */
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

function base(env: ReturnType<typeof readGhcServerEnv>) {
  return `${env.supabaseUrl!.replace(/\/$/, "")}/rest/v1`
}
function hdr(key: string, prefer = "return=representation") {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: prefer }
}
type StoredAnswer = { qid: string; salt: string; hash: string }
type Row = { answers: StoredAnswer[]; failed_attempts: number; locked_until: string | null }

async function loadRow(userId: string): Promise<{ ok: true; row: Row | null } | { ok: false; error: string }> {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false, error: "RECOVERY_SERVICE_UNAVAILABLE" }
  try {
    const res = await fetch(`${base(env)}/gh_withdrawal_pin_recovery?user_id=eq.${encodeURIComponent(userId)}&select=answers,failed_attempts,locked_until`,
      { headers: hdr(env.supabaseServiceRoleKey), cache: "no-store", signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return { ok: false, error: [400, 404, 406].includes(res.status) ? "RECOVERY_TABLE_PENDING" : "RECOVERY_SERVICE_UNAVAILABLE" }
    const rows = (await res.json().catch(() => [])) as Row[]
    return { ok: true, row: Array.isArray(rows) && rows[0] ? rows[0] : null }
  } catch { return { ok: false, error: "RECOVERY_SERVICE_UNAVAILABLE" } }
}

export async function getRecoveryStatus(userId: string) {
  const r = await loadRow(userId)
  if (!r.ok) return r
  if (!r.row) return { ok: true as const, configured: false, locked: false }
  const locked = !!r.row.locked_until && new Date(r.row.locked_until).getTime() > Date.now()
  return {
    ok: true as const, configured: true, locked, lockedUntil: r.row.locked_until,
    questions: questionsFor(r.row.answers.map((a) => a.qid)),
  }
}

/** Save answers for 3 distinct bank questions. Insert-only: cannot overwrite existing recovery. */
export async function setupRecovery(userId: string, questionIds: string[], answers: unknown[]) {
  const env = readGhcServerEnv()
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return { ok: false as const, error: "RECOVERY_SERVICE_UNAVAILABLE" }
  if (questionIds.length !== QUESTION_COUNT || new Set(questionIds).size !== QUESTION_COUNT
      || questionIds.some((q) => !QUESTION_BANK[q]) || answers.length !== QUESTION_COUNT
      || !answers.every(isUsableAnswer)) return { ok: false as const, error: "RECOVERY_INPUT_INVALID" }
  const norm = answers.map(normalizeAnswer)
  if (new Set(norm).size !== QUESTION_COUNT) return { ok: false as const, error: "RECOVERY_ANSWERS_MUST_DIFFER" }
  const stored: StoredAnswer[] = questionIds.map((qid, i) => {
    const salt = randomBytes(16).toString("hex")
    return { qid, salt, hash: hash(norm[i], salt) }
  })
  try {
    const res = await fetch(`${base(env)}/gh_withdrawal_pin_recovery`, {
      method: "POST", headers: hdr(env.supabaseServiceRoleKey, "resolution=ignore-duplicates,return=representation"),
      body: JSON.stringify({ user_id: userId, answers: stored }), cache: "no-store", signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return { ok: false as const, error: "RECOVERY_PERSIST_FAILED" }
    const ins = (await res.json().catch(() => [])) as unknown[]
    return Array.isArray(ins) && ins.length ? { ok: true as const } : { ok: false as const, error: "RECOVERY_ALREADY_CONFIGURED" }
  } catch { return { ok: false as const, error: "RECOVERY_SERVICE_UNAVAILABLE" } }
}

/** Verify all 3 answers (keyed by question id) and, only if correct, replace the withdrawal PIN. */
export async function resetPinWithAnswers(userId: string, answersByQid: Record<string, unknown>, newPin: string) {
  const env = readGhcServerEnv()
  const r = await loadRow(userId)
  if (!r.ok) return r
  if (!r.row) return { ok: false as const, error: "RECOVERY_NOT_CONFIGURED" }
  if (r.row.locked_until && new Date(r.row.locked_until).getTime() > Date.now()) return { ok: false as const, error: "RECOVERY_LOCKED" }
  let all = true
  for (const a of r.row.answers) {
    const given = normalizeAnswer(answersByQid[a.qid])
    const x = Buffer.from(hash(given, a.salt), "hex"), y = Buffer.from(a.hash, "hex")
    if (!(given && x.length === y.length && timingSafeEqual(x, y))) all = false
  }
  const k = env.supabaseServiceRoleKey!
  const patchRec = (body: object) => fetch(`${base(env)}/gh_withdrawal_pin_recovery?user_id=eq.${encodeURIComponent(userId)}`,
    { method: "PATCH", headers: hdr(k), body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }), cache: "no-store" }).catch(() => null)
  if (!all) {
    const attempts = Math.min((r.row.failed_attempts || 0) + 1, MAX_ATTEMPTS)
    const lockedUntil = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MS).toISOString() : null
    await patchRec({ failed_attempts: attempts, locked_until: lockedUntil })
    return { ok: false as const, error: lockedUntil ? "RECOVERY_LOCKED" : "RECOVERY_ANSWERS_INCORRECT" }
  }
  const salt = randomBytes(16).toString("hex")
  try {
    const res = await fetch(`${base(env)}/gh_withdrawal_pins?user_id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH", headers: hdr(k),
      body: JSON.stringify({ pin_hash: hash(newPin, salt), pin_salt: salt, failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() }),
      cache: "no-store", signal: AbortSignal.timeout(10_000),
    })
    const upd = res.ok ? ((await res.json().catch(() => [])) as unknown[]) : []
    if (!Array.isArray(upd) || !upd.length) return { ok: false as const, error: "PIN_NOT_CONFIGURED" }
  } catch { return { ok: false as const, error: "RECOVERY_SERVICE_UNAVAILABLE" } }
  await patchRec({ failed_attempts: 0, locked_until: null })
  return { ok: true as const }
}
