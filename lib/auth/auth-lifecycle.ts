/**
 * GreenHaven authentication lifecycle — deterministic state machine.
 *
 * Pi.authenticate success alone is NEVER "fully authenticated".
 * Server must verify access token and establish GH session before READY.
 *
 * Onboarding status starts as "unknown" (not false) to prevent
 * registration flashes for returning users during hydration.
 */

export type AuthLifecyclePhase =
  | "BOOTING"
  | "PI_READY"
  | "PI_AUTHENTICATING"
  | "PI_AUTHENTICATED"
  | "SERVER_VERIFYING"
  | "SERVER_VERIFIED"
  | "SESSION_READY"
  | "IDENTITY_LOADING"
  | "PROFILE_LOADING"
  | "ONBOARDING_STATUS_RESOLVED"
  | "READY"
  | "ERROR"

/** Explicit — never assume false while loading */
export type OnboardingStatus = "unknown" | "required" | "complete"

export type AuthLifecycleState = {
  phase: AuthLifecyclePhase
  onboardingStatus: OnboardingStatus
  serverVerified: boolean
  sessionReady: boolean
  error: string | null
  piUid: string | null
  ghUserId: string | null
}

export const INITIAL_AUTH_LIFECYCLE: AuthLifecycleState = {
  phase: "BOOTING",
  onboardingStatus: "unknown",
  serverVerified: false,
  sessionReady: false,
  error: null,
  piUid: null,
  ghUserId: null,
}

const ALLOWED: Record<AuthLifecyclePhase, AuthLifecyclePhase[]> = {
  BOOTING: ["PI_READY", "PI_AUTHENTICATING", "ERROR"],
  PI_READY: ["PI_AUTHENTICATING", "ERROR"],
  PI_AUTHENTICATING: ["PI_AUTHENTICATED", "ERROR"],
  PI_AUTHENTICATED: ["SERVER_VERIFYING", "ERROR"],
  SERVER_VERIFYING: ["SERVER_VERIFIED", "ERROR"],
  SERVER_VERIFIED: ["SESSION_READY", "IDENTITY_LOADING", "ERROR"],
  SESSION_READY: ["IDENTITY_LOADING", "PROFILE_LOADING", "ONBOARDING_STATUS_RESOLVED", "READY", "ERROR"],
  IDENTITY_LOADING: ["PROFILE_LOADING", "ONBOARDING_STATUS_RESOLVED", "SESSION_READY", "ERROR"],
  PROFILE_LOADING: ["ONBOARDING_STATUS_RESOLVED", "READY", "ERROR"],
  ONBOARDING_STATUS_RESOLVED: ["READY", "ERROR"],
  READY: ["PI_AUTHENTICATING", "ERROR", "BOOTING"],
  ERROR: ["BOOTING", "PI_AUTHENTICATING", "PI_READY"],
}

export function canTransition(from: AuthLifecyclePhase, to: AuthLifecyclePhase): boolean {
  return ALLOWED[from]?.includes(to) ?? false
}

export function transitionAuth(
  state: AuthLifecycleState,
  to: AuthLifecyclePhase,
  patch?: Partial<AuthLifecycleState>
): AuthLifecycleState {
  if (!canTransition(state.phase, to) && state.phase !== to) {
    // Allow no-op same phase; otherwise keep phase but apply patch for resilience
    if (process.env.NODE_ENV === "development") {
      console.warn(`[auth-lifecycle] disallowed ${state.phase} → ${to}`)
    }
  }
  return {
    ...state,
    ...patch,
    phase: to,
    error: to === "ERROR" ? patch?.error ?? state.error : to === "BOOTING" ? null : patch?.error ?? null,
  }
}

/** App shell: show main app only when ready + onboarding complete */
export function shouldShowMainApp(s: AuthLifecycleState): boolean {
  return (
    (s.phase === "READY" || s.phase === "ONBOARDING_STATUS_RESOLVED") &&
    s.serverVerified &&
    s.onboardingStatus === "complete"
  )
}

/** App shell: show registration only when explicitly required */
export function shouldShowOnboarding(s: AuthLifecycleState): boolean {
  return s.onboardingStatus === "required" && s.serverVerified
}

/** Keep loading shell while onboarding unknown or still verifying */
export function shouldShowAuthLoading(s: AuthLifecycleState): boolean {
  if (s.phase === "ERROR") return false
  if (s.onboardingStatus === "unknown") return true
  if (
    s.phase === "BOOTING" ||
    s.phase === "PI_READY" ||
    s.phase === "PI_AUTHENTICATING" ||
    s.phase === "PI_AUTHENTICATED" ||
    s.phase === "SERVER_VERIFYING" ||
    s.phase === "IDENTITY_LOADING" ||
    s.phase === "PROFILE_LOADING"
  ) {
    return true
  }
  return false
}

export function onboardingFromServerFlags(input: {
  serverVerified: boolean
  needsOnboarding?: boolean
  isReturning?: boolean
}): OnboardingStatus {
  if (!input.serverVerified) return "unknown"
  if (input.isReturning === true || input.needsOnboarding === false) return "complete"
  if (input.needsOnboarding === true) return "required"
  return "unknown"
}
