# 0.137.0 — Public legal routes (Pi Portal)

## Bug
`components/app-wrapper.tsx` gated *all* pages on `usePiAuth().isAuthenticated`, so `/privacy`, `/terms`, and `/support` never rendered the LegalPage — only AuthLoadingScreen.

## Fix
`AppContent` allows these path prefixes without authentication or session lock:
- `/privacy`
- `/terms`
- `/support`
- `/portal-setup`
- `/validation-key.txt`

Main app shell, PiAuthProvider, SessionLockGate, and API auth are unchanged.

## Verify
Open `/privacy` in an Incognito window (not signed into Pi). The policy body must appear.
