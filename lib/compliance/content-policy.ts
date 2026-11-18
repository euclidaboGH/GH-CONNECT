/**
 * Content policy checks aligned with safe social / dating use and Pi guidelines.
 */

export type ContentVerdict = {
  allowed: boolean
  severity: "none" | "low" | "high"
  reasons: string[]
}

const HIGH_RISK = [
  /\b(child\s*porn|csam|only\s*fans\s*minor|underage\s*(sex|nude|porn))\b/i,
  /\b(terror(ist|ism)?\s*attack|make\s*a\s*bomb)\b/i,
]

const MEDIUM_RISK = [
  /\b(kill\s*yourself|kys)\b/i,
  /\b(rape|sexual\s*assault)\b/i,
  /\b(wire\s*transfer|send\s*(btc|bitcoin|crypto)\s*first)\b/i,
  /\b(nude\s*pic|send\s*nudes)\b/i,
]

export function evaluateUserContent(text: string): ContentVerdict {
  const value = typeof text === "string" ? text.trim() : ""
  const reasons: string[] = []
  let severity: ContentVerdict["severity"] = "none"

  if (!value) {
    return { allowed: true, severity: "none", reasons: [] }
  }

  for (const rule of HIGH_RISK) {
    if (rule.test(value)) {
      reasons.push("Prohibited content")
      severity = "high"
    }
  }

  for (const rule of MEDIUM_RISK) {
    if (rule.test(value)) {
      reasons.push("Policy-restricted content")
      if (severity !== "high") severity = "low"
    }
  }

  if (value.length > 5000) {
    reasons.push("Too long")
    if (severity === "none") severity = "low"
  }

  return {
    allowed: severity !== "high",
    severity,
    reasons: Array.from(new Set(reasons)),
  }
}

export function moderationMessage(verdict: ContentVerdict): string {
  if (verdict.allowed && verdict.severity === "none") return ""
  if (!verdict.allowed) {
    return "This content violates our Community Guidelines and cannot be published."
  }
  return "Please review our guidelines — this content may be limited."
}
