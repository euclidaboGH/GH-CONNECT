import type { HomeCrossFeatureSignal } from "@/lib/home-cross-feature"

/**
 * Presentation-quality guard for Home outcome signals.
 * Keeps the primary action singular, removes duplicate destinations, and
 * preserves the strongest authoritative signal when several paths overlap.
 */
export function prepareHomeOutcomeSignals(signals: HomeCrossFeatureSignal[]): HomeCrossFeatureSignal[] {
  const seenTargets = new Set<string>()
  const result: HomeCrossFeatureSignal[] = []

  for (const signal of [...signals].sort((a, b) => b.priority - a.priority)) {
    const target = signal.target.trim().toLowerCase()
    if (!target || seenTargets.has(target)) continue
    seenTargets.add(target)
    result.push(signal)
    if (result.length === 4) break
  }

  return result
}

export function outcomeEvidenceLabel(evidence: HomeCrossFeatureSignal["evidence"]): string {
  switch (evidence) {
    case "server":
      return "Confirmed by GreenHaven services"
    case "profile":
      return "Based on your profile and setup"
    case "relationship":
      return "Based on your connections"
    default:
      return "Based on your current activity"
  }
}
