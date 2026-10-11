# Messaging / chat — surgical modernization (2026-10-11)

## Five missing parts added

1. **Thread offline banner** — draft allowed; send blocked until online  
2. **Escape closes thread** — return to inbox  
3. **Inbox filter keyboard** — ←/→/Home/End + roving tabindex  
4. **Conversation result count** + list semantics  
5. **Composer a11y** — labels, disabled when offline, durable status live region  

## Twenty maintenance areas

1. Offline in thread (not only inbox)  
2. Disable send while offline (no silent drop)  
3. SR status on send  
4. Escape to close  
5. Filter keyboard navigation  
6. Filter focus rings  
7. Result counts  
8. `role="log"` on message stream  
9. Composer aria-labels  
10. Send uses `--gh-green`  
11. ChatHeader back touch target  
12. Placeholder when disabled  
13. Enter / Shift+Enter helper copy  
14. Communities empty → browse communities  
15. Open community conversation filter (prior)  
16. Durable/hybrid inbox banner (prior)  
17. Reconcile on reconnect (prior)  
18. No fabricated messages  
19. Mark read when opening thread (existing)  
20. Documented durability operator gates  

## Files

- `components/ghc/message-screen.tsx`
- `components/ghc/message-components.tsx`

## Safety

- No invented conversations or message bodies  
- Send still uses existing `sendMessage`  
- Offline does not claim durable delivery  
