# Discover / Find — surgical modernization (2026-10-11)

## Five missing parts added

1. **Offline banner** — honest local-only discovery when offline  
2. **Filters toggle** — header control shows/hides connection intent bar  
3. **Category keyboard nav** — Arrow/Home/End + roving tabindex  
4. **Visible Pass** on UserCard action row (with Like for matching)  
5. **Status messaging** — SR + toast for like/pass outcomes  

## Twenty maintenance areas

1. Offline awareness  
2. Filter button was non-functional → toggles intents  
3. Category a11y keyboard  
4. Category focus rings  
5. Premium loading skeletons  
6. Search-aware empty secondary action  
7. Result count + search query display  
8. List role semantics  
9. Like = matching (emerald), not post-vote  
10. Pass on primary card row  
11. Pass toast feedback  
12. Like copy: mutual opportunity not auto-connect  
13. Intent intro copy clarified  
14. No manufactured candidates  
15. Connection picker unchanged (real API)  
16. Modern/classic card toggle retained  
17. Error retry via existing refresh event  
18. Clear search/filters resets category people  
19. Status aria-live region  
20. Documented engagement split with feed  

## Files

- `components/ghc/discovery-grid-screen.tsx`
- `components/ghc/user-card.tsx`
- `components/ghc/discovery-object-card.tsx`
