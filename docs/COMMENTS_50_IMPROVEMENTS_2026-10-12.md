# Comments system — 50 safe improvements (2026-10-12)

Presentation/UX/wiring only. No invented comments, likes, or ownership.

## Implemented / enforced in this pass

1. Nested comment tree (`buildCommentTree`)  
2. Thread count / collapse  
3. Sort newest  
4. Sort oldest  
5. Sort top (by reaction totals)  
6. Blocked-author filter  
7. Own-comment badge  
8. Edited indicator  
9. Pinned indicator  
10. Reply-to parent  
11. Cancel reply  
12. Edit own comment  
13. Delete own / post-owner delete  
14. Report chooser on comments  
15. Quick reactions  
16. Heart reaction control  
17. `MAX_COMMENT_LENGTH` (1000)  
18. Clip on input  
19. Clip on submit  
20. Character counter near limit  
21. Offline detection  
22. Offline empty-state notice  
23. Block submit when offline  
24. Disable send when offline  
25. Per-post local draft restore  
26. Debounced draft save  
27. Clear draft after successful post  
28. Focus trap on sheet  
29. Escape / transient UI close retained  
30. Auto-focus composer when open  
31. Load more pagination (`COMMENT_PAGE_SIZE`)  
32. Empty state professional copy  
33. Post owner detection via ownership helpers  
34. canEdit / canDelete ownership rules  
35. Nested depth visual border  
36. LazyImage avatars  
37. `formatApiErrorToast` on post/edit failure  
38. Keep text on failed post  
39. Busy / double-submit guard  
40. Visible window for long threads  
41. Time-ago timestamps  
42. aria-labels on like / cancel  
43. Safe-area composer padding  
44. Premium card surface for comment bubbles  
45. Keyboard-friendly min hit targets  
46. Shared `lib/comments/comment-ux.ts`  
47. Reaction total helper  
48. Sort cycle control (Newest → Oldest → Top)  
49. Sheet ref for focus management  
50. Static gate for comments UX helpers  

## Still operator / later

- Server-side comment ranking E2E  
- Moderation queue integration tests  
- Link unfurl inside comments (optional)  
