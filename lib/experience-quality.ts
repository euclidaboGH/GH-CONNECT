export type ExperienceStateKind = "loading" | "empty" | "error" | "success" | "offline"

export type ExperienceCopy = {
  title: string
  description?: string
  actionLabel?: string
}

export const EXPERIENCE_COPY: Record<ExperienceStateKind, ExperienceCopy> = {
  loading: { title: "Loading", description: "GreenHaven is getting the latest available information." },
  empty: { title: "Nothing here yet", description: "There is no activity to show right now." },
  error: { title: "We couldn't load this", description: "Your information is safe. Try again when you're ready." },
  success: { title: "You're all set", description: "The latest action was completed successfully." },
  offline: { title: "You're offline", description: "Reconnect to continue with the latest information." },
}

export function normalizeExperienceError(error: unknown, fallback = "We couldn't complete that request right now.") {
  const message = error instanceof Error ? error.message.trim() : typeof error === "string" ? error.trim() : ""
  return message || fallback
}
