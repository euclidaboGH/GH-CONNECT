# Notification deep-links (2026-10-18)

## Goals
Tapping a social notification opens the right surface:
- Connection request → Matches + connection inbox overlay
- Like / curation → Home, scroll to post
- Comment → Home, open comment sheet on post
- Follow → Discover (+ profile when id present)

## Changes
- NotificationType aliases: post_like, post_comment, connection_request, curation
- Bell maps durable social rows with postId / actorUserId / friend_request
- resolveDeepLink routes connection_request → matches + connection_requests section
- executeDeepLink delays inbox open so Matches mounts first
- Comment notifications open post with action "comment"
- Connection requests no longer force peer profile open

## Tests
`npm run test:notification-deeplink`
