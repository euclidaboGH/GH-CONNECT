# Profile details & interests fix (2026-10-12)

## Issues reported
- Interests step showed no options
- Manual interest input did not record

## Fixes
1. Expanded `INTERESTS` catalog (hobbies / professional / lifestyle)
2. Onboarding: custom interest field (Enter/Add) + selected chips + fallback list
3. Edit Profile: full preset chip grid + custom field; always save cleaned `interests[]`
4. `updateProfile` writes `ghc.profile` localStorage immediately so interests survive refresh
5. Profile save normalizes interests array before domain mutation

## How to use
- Onboarding step 3: tap chips and/or type your own → Continue
- Profile → Edit: select presets or Add → **Save Changes**
