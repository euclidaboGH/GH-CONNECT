# 0.338.38 — Pi auth false-negative fix + 30 premium upgrades

## Critical bug
Users in Pi Browser were told "Pi Browser is required / Couldn't sign you in" when window.Pi loaded late or UA detection failed.

## Fixes
1. Expanded isPiBrowserRuntime (PiApp, WebView, referrer, UA variants)
2. detectPiEnvironment bridge + referrer hints
3. Longer bridge waits (14s auth, 10s runtime)
4. humanize never claims Pi required when already in Pi
5. One soft auto-retry when in Pi and bridge fails
6. Auth screen title: "Still connecting to Pi" when in Pi
7. Retry label neutral; footer adapts

## Premium / UX (30 gate checks)
- premium-interaction helpers (haptic, relative time, hide zero metrics)
- Quality chip polish, feed/marketplace load-more targets
- Offline banner payment honesty
- Withdraw sheet dvh max-height
- Discovery honesty copy
- Prior withdraw/consent progressive scopes retained

Production NOT APPROVED.
