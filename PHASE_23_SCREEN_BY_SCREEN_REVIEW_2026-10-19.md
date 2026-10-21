# Phase 23 — Screen-by-Screen Accessibility and Responsive Review

**Status:** automated source assertions are not a substitute for human device review. Manual device review still required.

## Automated source coverage

- Feed, Discover, Profile, Messages inbox/thread, Communities, Marketplace, Wallet, Settings and Onboarding should expose named semantic landmarks.
- Pi SDK loading and payment creation must fail closed when initialization is unavailable or unsafe.
- Responsive visual QA should cover 320/360/390 px mobile widths, tablet and desktop sizes, keyboard-open states, offline/API-failure states, and horizontal overflow.
- Forced-colors support, keyboard navigation, focus visibility, readable errors and non-blocking loading states must be reviewed.

## Required manual matrix

| Surface | Manual review |
|---|---|
| Pi Browser sign-in and checkout | Verify real Testnet flow, loading, cancellation, retry and error recovery |
| Feed and post composer | Upload progress, failed media, keyboard overlap, focus and screen-reader labels |
| Profile and settings | Form validation, keyboard-only navigation and responsive layout |
| Messages and notifications | Empty/loading/error states, unread indicators and deep-link destination |
| Marketplace and membership | Clear price, payment rail, confirmation, failure and refund wording |
| Wallet and GHC rewards | Distinguish Pi from GHC; verify no client-trusted balance or false success |

## Release condition

Attach actual screenshots or test artifacts from supported devices and Pi Browser, plus keyboard/accessibility findings and resolved blockers. Do not label the release production-ready based on this document or static tests alone.
