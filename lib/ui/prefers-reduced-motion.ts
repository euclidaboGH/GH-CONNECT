/** Phase 3 — respect prefers-reduced-motion across compose, stories, wallet. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}

/** CSS class fragment: skip enter animations when reduced motion is on. */
export function motionEnterClass(enabledClass: string, reducedClass = ""): string {
  if (typeof window === "undefined") return enabledClass
  return prefersReducedMotion() ? reducedClass : enabledClass
}
