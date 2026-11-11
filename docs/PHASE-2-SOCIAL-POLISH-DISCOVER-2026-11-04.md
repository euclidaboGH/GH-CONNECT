# Phase 2 — Social polish (Discover + identity + notifications)

**Baseline:** Phase 1 trust-breakers media package  
**Date:** 4 November 2026  

## Goals

1. One clear CTA hierarchy on Discover cards  
2. Soft-revalidate + follow-changed after Follow/Connect  
3. Presence honesty (no invented last-seen)  
4. Canonical `@handle` lower-case  
5. Notifications focus defaults to **Priority**  

## Changes

| Area | Change |
|------|--------|
| Discover presence sheet | Removed `Math.random()` “Last seen / months ago”; server `online` only |
| Online filter chip | “Online only” when presence is known; “Presence offline” otherwise |
| Following state | `idListIncludes` for alias-safe following; emit `ghc:follow-changed` |
| ConnectionCard | Primary weight on Connect/Accept/Message; quiet secondary for Interest/Pass/Profile |
| MATCH_CLARITY | Like → **Interest** (matching only, not post-like) |
| UserCard | Primary **Follow** / **Following** when `onFollow` provided; Profile secondary |
| Profile handle | Always `@lowercase` |
| Notifications | Default focus **priority**; sessionStorage `ghc.notif.focus` |

## Verify

```bash
node scripts/check-phase2-social-polish-discover-2026-11-04.mjs
```
