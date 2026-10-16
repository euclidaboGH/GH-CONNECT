# Phase 4 — Session & profile persistence

## Done
- Onboarding UI gate honors device stamp even during Pi uid / GH id race
- Pi `needsOnboarding` path merges local completed profile and stamps onboarded
- `updateProfile` writes `ghc.profile` + onboarding stamp when shape is strong
- `completeOnboarding` stamps with multiple alt ids
- Edit Profile interests: INTERESTS catalog chips + custom add (values persist via updateProfile)

## Not changed
- Server identity authority when durable `onboardingStatus === complete`
- PIN/WebAuthn crypto
