# Matches — surgical modernization (2026-10-11)

## Five missing parts added

1. **Offline banner** — device matches remain; sync later  
2. **Escape** closes connection inbox / intent picker  
3. **Match tab keyboard** (New / All) + a11y roles  
4. **Result count** on the list  
5. **SR status** for connect / hide feedback  

## Twenty maintenance areas

1. Offline awareness  
2. Escape for overlays  
3. Tablist semantics  
4. Filter focus rings  
5. Brand tokens (`--gh-green`)  
6. Intention chip tokens  
7. Connection inbox button tokens  
8. Result counts  
9. Honest **hide on device** (not server delete claim)  
10. Status live region  
11. Dead import cleanup on MatchScreen  
12. Mutual interest copy retained  
13. Connect ≠ Like (intent picker kept)  
14. Message opens real conversation  
15. No fabricated matches  
16. Loading skeletons retained  
17. Empty → Find CTA  
18. Request inbox deep-link  
19. Profile open event  
20. Documented product boundary  

## Product boundary

- **Match** = mutual interest opportunity  
- **Connect** = explicit request with intents  
- **Message** = start private conversation  
- Hide is **local UI** only unless a durable unmatch API exists  

## Files

- `components/ghc/match-screen.tsx`
- `components/ghc/matches-components.tsx`
