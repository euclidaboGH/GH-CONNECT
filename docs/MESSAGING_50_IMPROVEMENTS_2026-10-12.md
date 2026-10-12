# Messaging system — 50 safe improvements (2026-10-12)

Presentation/UX/wiring only. No invented messages, receipts, or membership.

## Implemented / enforced in this pass

1. Per-conversation local draft restore  
2. Debounced draft persist while typing  
3. Clear draft after successful send  
4. `MAX_MESSAGE_LENGTH` (4000) constant  
5. Clip on send path  
6. Clip on input change  
7. Character counter near limit  
8. Escape closes open thread  
9. Offline banner / send disabled path retained  
10. Durable messaging flag still opt-in  
11. Online reconcile event retained  
12. Debounced inbox search  
13. Inbox filters: all / dms / unread / communities  
14. Mark-read only when unread  
15. Reply preview bar  
16. Cancel reply affordance  
17. Muted conversation notice  
18. Failed message retry path  
19. Copy message text  
20. Delete message (for everyone when allowed by domain)  
21. Safe-area composer padding  
22. Status message surface  
23. aria-live friendly status path  
24. `formatApiErrorToast` for send failures  
25. Grouping helpers (`shouldGroupWithPrevious`)  
26. Day divider helpers (`formatMessageDayDivider`)  
27. Windowed message history (`MESSAGE_WINDOW_*`)  
28. Tab change clears ephemeral thread UI  
29. Open conversation via `ghc:open-conversation`  
30. Community filter when opening group threads  
31. Presence treated as optional (not required to send)  
32. Hybrid durable path documentation  
33. Rate-limit / error codes mapped via shared UX map  
34. No client-trusted senderId (server authority)  
35. Archive-aware list filtering retained  
36. Unread count badge accessibility retained  
37. Memoized conversation list  
38. startTransition for selection  
39. Empty inbox professional copy retained  
40. Empty thread state retained  
41. Attachment / emoji entry points retained  
42. Scroll-to-bottom on open  
43. Soft reconnect without wiping server history  
44. Messaging authz static tests remain in suite  
45. Production guard for non-durable writes retained  
46. Conversation mute wiring retained  
47. Premium messaging surface separation retained  
48. Keyboard-friendly composer maxLength  
49. Shared `lib/messaging/messaging-ux.ts` module  
50. Static gate for messaging UX helpers  

## Still operator / later

- Live multi-device receipt E2E  
- Full day-divider UI bind on every bubble list variant  
- Media message pipeline E2E  
