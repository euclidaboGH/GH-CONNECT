# GreenHaven Reference Video Audit — Product Principles

The provided walkthroughs are the primary visual/behavioral references for the planned upgrade. This document records observed patterns and design implications, not a claim that every screen or backend behavior has been runtime-tested.

## Facebook reference

- Persistent, recognizable top-level navigation and quick access to feed, friends, messages, notifications, and menu.
- Content-first feed with visible author identity, media, engagement actions, and contextual actions.
- Friends and inbox screens use compact rows, avatars, previews, and clear unread markers.
- Notification center separates recent/earlier items and gives actionable requests explicit accept/decline choices.
- Profile surfaces separate identity/header details, friends/highlights, and authored content.
- Skeleton placeholders communicate loading while retaining the final screen's rough geometry.

## WhatsApp reference

- Inbox is the primary entry point for conversations, with search and clear conversation previews.
- Tabs/filters distinguish categories such as unread, favorites, and groups.
- Conversation list prioritizes avatar, name, last-message preview, time, and unread count.
- A persistent, obvious creation action makes starting a conversation easy.
- Preserve message drafts and provide clear sending, failure, retry, and reconnect states in GreenHaven.

## X reference principles for research and comparison

- Fast, scannable feed hierarchy; clear author attribution and post actions.
- Search/discovery and notification affordances should be easy to find without overwhelming the content surface.
- Distinguish original posts, replies, repost/reshare behavior, and conversation context where GreenHaven supports analogous features.
- Avoid copying X's branding, terminology, ranking assumptions, or interaction details blindly; map only patterns to existing GreenHaven capabilities.

## GreenHaven-specific implementation rules

- Do not clone competitor logos, brand colors, or exact screen designs. Use reference patterns to improve familiarity while retaining GreenHaven's own design language.
- Keep the existing logo unchanged until a replacement is supplied.
- Ensure compact layouts remain touch-friendly and accessible; small visual density must not shrink hit targets or text below readable sizes.
- Each async surface needs appropriate loading, empty, error, retry, and success states. Skeletons should not flash unnecessarily or create layout shift.
- Preserve existing auth, privacy, identity, wallet, rewards, payment, and database contracts.
- Check responsive behavior on small Android devices, larger phones, tablets, and desktop; account for safe areas and keyboard/composer overlap.

## Required audit matrix before implementing each surface

For every route/screen: source file(s), entry/navigation path, data dependencies, loading/empty/error/success states, pagination, permissions, retry/idempotency behavior, accessibility, responsive behavior, and automated/manual evidence. A video frame demonstrates appearance at one moment; it does not prove all interactive states.
