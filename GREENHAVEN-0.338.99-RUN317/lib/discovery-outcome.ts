export type DiscoveryOutcomeInput = {
  visiblePeople: number
  selectedIntentCount: number
  hasQuery: boolean
  onlineOnly: boolean
}

export function buildDiscoveryOutcome(input: DiscoveryOutcomeInput) {
  if (input.visiblePeople > 0) {
    return {
      title: `${input.visiblePeople} relevant ${input.visiblePeople === 1 ? "person" : "people"} available`,
      detail: input.selectedIntentCount > 0
        ? "Results reflect your selected connection intent. Review the reasons before choosing interest, connect or profile actions."
        : "Choose a connection intent to make discovery more purposeful and explainable.",
      state: "ready" as const,
    }
  }
  if (input.hasQuery || input.onlineOnly || input.selectedIntentCount > 0) {
    return {
      title: "No visible matches for these filters",
      detail: "Broaden the search or filters. Existing privacy, block, connection and request boundaries remain enforced.",
      state: "attention" as const,
    }
  }
  return {
    title: "Shape what you want to discover",
    detail: "Set a connection intent or search term to focus GreenHaven on people relevant to your purpose.",
    state: "start" as const,
  }
}
