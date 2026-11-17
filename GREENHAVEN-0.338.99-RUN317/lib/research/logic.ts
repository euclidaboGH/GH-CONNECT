export type ResearchConditionOperator = "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "answered" | "not_answered"
export type ResearchCondition = { questionId: string; operator: ResearchConditionOperator; value?: string | number }
export type ResearchQuestion = { id: string; type: string; label: string; required?: boolean; options?: string[]; showWhen?: ResearchCondition }

const OPERATORS = new Set<ResearchConditionOperator>(["equals", "not_equals", "contains", "greater_than", "less_than", "answered", "not_answered"])
export function validateResearchLogic(questions: ResearchQuestion[]): { ok: true } | { ok: false; reason: string } {
  if (!Array.isArray(questions) || questions.length > 80) return { ok: false, reason: "QUESTION_LIMIT" }
  const seen = new Set<string>()
  for (const q of questions) {
    if (!q || typeof q.id !== "string" || !q.id || seen.has(q.id)) return { ok: false, reason: "INVALID_QUESTION_ID" }
    const condition = q.showWhen
    if (condition) {
      if (!condition || typeof condition.questionId !== "string" || !seen.has(condition.questionId)) return { ok: false, reason: "CONDITION_MUST_REFERENCE_PREVIOUS_QUESTION" }
      if (!OPERATORS.has(condition.operator)) return { ok: false, reason: "INVALID_CONDITION_OPERATOR" }
      if (!["answered", "not_answered"].includes(condition.operator) && (typeof condition.value !== "string" && typeof condition.value !== "number")) return { ok: false, reason: "CONDITION_VALUE_REQUIRED" }
      if (typeof condition.value === "string" && condition.value.length > 240) return { ok: false, reason: "CONDITION_VALUE_TOO_LONG" }
    }
    seen.add(q.id)
  }
  return { ok: true }
}

export function isResearchQuestionVisible(condition: ResearchCondition | undefined, answers: Record<string, unknown>): boolean {
  if (!condition) return true
  const actual = answers[condition.questionId]
  const empty = actual === undefined || actual === null || actual === "" || (Array.isArray(actual) && actual.length === 0)
  switch (condition.operator) {
    case "answered": return !empty
    case "not_answered": return empty
    case "equals": return String(actual ?? "") === String(condition.value ?? "")
    case "not_equals": return String(actual ?? "") !== String(condition.value ?? "")
    case "contains": return Array.isArray(actual) ? actual.map(String).includes(String(condition.value)) : String(actual ?? "").includes(String(condition.value ?? ""))
    case "greater_than": return Number(actual) > Number(condition.value)
    case "less_than": return Number(actual) < Number(condition.value)
    default: return false
  }
}

export function reconcileElectionTally(input: { candidateVotes: number[]; validVotes: number; rejectedBallots: number; totalBallots?: number | null; accreditedVoters?: number | null; registeredVoters?: number | null }) {
  const candidateTotal = input.candidateVotes.reduce((sum, value) => sum + value, 0)
  const discrepancies: string[] = []
  if (candidateTotal !== input.validVotes) discrepancies.push("CANDIDATE_TOTAL_MISMATCH")
  if (input.totalBallots != null && input.totalBallots !== input.validVotes + input.rejectedBallots) discrepancies.push("BALLOT_TOTAL_MISMATCH")
  if (input.accreditedVoters != null && input.totalBallots != null && input.totalBallots > input.accreditedVoters) discrepancies.push("BALLOTS_EXCEED_ACCREDITED")
  if (input.registeredVoters != null && input.accreditedVoters != null && input.accreditedVoters > input.registeredVoters) discrepancies.push("ACCREDITED_EXCEED_REGISTERED")
  return { candidateTotal, reconciled: discrepancies.length === 0, discrepancies }
}
