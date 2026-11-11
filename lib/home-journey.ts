export type JourneyStep = {
  id: "profile" | "discover" | "connect" | "participate"
  title: string
  description: string
  target: string
  done: boolean
}

export function buildHomeJourney(input: {
  profileComplete: boolean
  hasDiscoverySignals: boolean
  hasConnection: boolean
  hasParticipation: boolean
}): { steps: JourneyStep[]; completed: number; total: number; percent: number; next: JourneyStep | null } {
  const steps: JourneyStep[] = [
    { id: "profile", title: "Complete your identity", description: "Add the details that help people and communities understand you.", target: "profile", done: input.profileComplete },
    { id: "discover", title: "Discover your interests", description: "Explore people, communities, creators, activities and services that fit you.", target: "discover", done: input.hasDiscoverySignals },
    { id: "connect", title: "Build your circle", description: "Turn a useful discovery into a meaningful connection or conversation.", target: "messages", done: input.hasConnection },
    { id: "participate", title: "Take part", description: "Share, vote, join a community, complete a challenge or use a service.", target: "communities", done: input.hasParticipation },
  ]
  const completed = steps.filter((step) => step.done).length
  return { steps, completed, total: steps.length, percent: Math.round((completed / steps.length) * 100), next: steps.find((step) => !step.done) || null }
}
