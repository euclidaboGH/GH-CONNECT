# Notifications — surgical modernization (2026-10-11)

## Five missing parts added

1. **Offline banner** in the panel  
2. **Escape** closes the panel  
3. **Category tab keyboard** (←/→/Home/End) + tab roles  
4. **Result count** + refresh hint  
5. **Durable-unavailable** honesty when server list fails  

## Twenty maintenance areas

1. Offline awareness  
2. Escape dismiss  
3. Loading state on server merge  
4. Durable ok / fail signal  
5. Bucket tablist a11y  
6. Roving tabindex on categories  
7. Focus rings  
8. Mark-all aria-label + status  
9. Unread badge brand token  
10. Unread dot token  
11. Community label emerald  
12. Result counts  
13. List semantics  
14. Bell `aria-expanded`  
15. Deep-link path retained  
16. Server mark_read retained  
17. Local + durable merge retained  
18. No fabricated notifications  
19. Interval refresh retained  
20. Documented authority (server when durable)  

## Authority

- Local `notificationSystem` for device events  
- `/api/social/notifications` durable when available  
- Mark read posts to API for durable ids  

## Files

- `components/ghc/notification-bell.tsx`
