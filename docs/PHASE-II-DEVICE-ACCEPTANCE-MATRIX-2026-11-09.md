# Phase II responsive, Android and Pi Browser acceptance matrix

**Date:** 2026-11-09  
**Baseline:** GREENHAVEN 0.338.6  
**Status:** HARNESS PREPARED — real preview screenshots and physical-device acceptance NOT RUN.

## Automated responsive screenshot harness

The repository now includes `scripts/capture-phase2-responsive-screenshots.mjs`. It uses the already-declared `@playwright/test` development dependency and captures the app shell (or unauthenticated entry surface) at seven viewport classes in both light and dark color schemes. When the authenticated canonical navigation is available, it also captures each navigation destination. It records page errors and fails on document-level horizontal overflow or an app shell wider than the viewport.

Run against a deployed Vercel Preview after installing dependencies with the project-supported Node runtime:

```bash
GREENHAVEN_PREVIEW_URL="https://YOUR-VERCEL-PREVIEW-URL" \
  npm run capture:phase2-responsive
```

For authenticated screenshots, supply a locally-created Playwright storage-state file. Do not commit session cookies, auth tokens, storage state, screenshots containing private user data, or production secrets:

```bash
GREENHAVEN_PREVIEW_URL="https://YOUR-VERCEL-PREVIEW-URL" \
GREENHAVEN_STORAGE_STATE="/secure/local/path/greenhaven-preview-state.json" \
  npm run capture:phase2-responsive
```

Default output is `artifacts/phase2-responsive/`; set `GREENHAVEN_SCREENSHOT_DIR` to change it. Review every screenshot manually for layout clipping, unreadable text, broken media, sticky overlays, safe-area collisions and theme contrast. Automated viewport capture is not a substitute for physical-device testing.

## Viewport matrix

| Class | Viewport | Touch | Theme coverage |
|---|---:|---|---|
| Compact Android | 360 × 800 | Yes | Light + dark |
| Standard Android | 393 × 852 | Yes | Light + dark |
| Large Android | 432 × 960 | Yes | Light + dark |
| Tablet portrait | 768 × 1024 | Yes | Light + dark |
| Tablet landscape | 1024 × 768 | Yes | Light + dark |
| Desktop | 1440 × 900 | No | Light + dark |
| Ultra-wide | 1920 × 1080 | No | Light + dark |

## Physical Android and Pi Browser checklist

These checks require a real Android device and the Pi Browser application; they were not performed in the source workspace.

- Install/open the same Vercel Preview build on a compact Android phone, a larger phone and a tablet where available.
- Confirm Pi Browser sign-in/SDK initialization and return-from-background behavior. Do not submit a payment or payout during UI acceptance.
- Test system back, in-app back, external links and return-to-app navigation.
- Test camera/gallery permission denial, upload cancellation, retry and successful media preview using non-sensitive test media.
- Test image galleries and video playback on constrained bandwidth; confirm videos do not download metadata for every off-screen feed card.
- Enable Android Data Saver and reduced-data preference; confirm the first feed batch is smaller and non-critical prefetch stays disabled.
- Rotate portrait/landscape while feed, messages, marketplace and sheets are open.
- Test Android font scaling, long names, long localized strings, emoji, right-to-left locale and 200% browser zoom where available.
- Check keyboard focus order, visible focus, screen-reader labels, touch targets (minimum 44 CSS px where practical), safe areas and fixed navigation overlap.
- Test loss/recovery of connectivity during feed pagination and media resolution. Verify no duplicate pagination requests or misleading success states.

## Acceptance criteria

- No document-level horizontal overflow at any viewport.
- No clipped primary actions, dialog content or bottom navigation.
- Feed and conversation columns remain readable on tablet/desktop without stretching indefinitely.
- Images retain aspect ratio and layout space; only first visible feed-card image may receive eager/high priority.
- Off-screen feed video uses `preload="none"`; constrained-data settings prevent background media prefetch.
- Reduced motion is respected; focus is visible; controls remain operable without touch.
- All critical workflows pass on real Android and Pi Browser, including camera/media permissions and back navigation.
- Record device model, Android version, Pi Browser version, preview commit, screenshot set, test account class and defects. Never include personal data or payment details in evidence.

**Current result:** harness and acceptance checklist are committed in source. No screenshots were generated because no preview URL, authenticated test session, installed Playwright browser or physical Android/Pi Browser device was available in the workspace. The project is not certified as compatible with every device until this matrix passes on representative real devices.
