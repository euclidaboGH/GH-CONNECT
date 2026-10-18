# Connection inbox hydrate on focus (2026-10-18)

## Goal
Recipients see durable connection requests without a hard refresh.

## Changes
- Social mutation handler always re-pulls **feed + connection inbox + follows**
- Server inbox rows preferred when durable; candidate names used when available
- Foreground/visibility revalidate every **12s** (was 45s) includes inbox + follows
- Emits `ghc:connection-inbox-updated`
- App badge listens to inbox-updated, social-mutation, connection-updated
- Connection Request Inbox reloads on focus / visibility / mutation events

## Tests
`npm run test:inbox-hydrate`
plus prior server-first social suites
