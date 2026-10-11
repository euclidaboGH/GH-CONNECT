# Communities / group hub — surgical modernization (2026-10-11)

## Five missing parts added

1. **Directory loading skeleton** while `GET /api/communities` resolves  
2. **Directory error + Try again** (fail-closed, no fake groups)  
3. **Offline banner** on the communities directory  
4. **Directory tab a11y** (`role="tablist"`, `aria-selected`, focus rings)  
5. **Hub space keyboard navigation** (Board / Chat / … arrow keys)

## Twenty maintenance areas

1. Offline awareness  
2. Directory fetch loading state  
3. Directory fetch error recovery  
4. SR status region  
5. My / Discover tab semantics  
6. Focus-visible on directory tabs  
7. Create CTA uses `--gh-green`  
8. Category chips use design tokens  
9. Empty-my CTAs tokenized  
10. Hub Chat tab color aligned to brand green  
11. Hub tab roving tabindex  
12. Board vs Chat copy retained (honest)  
13. No fabricated directory rows  
14. Join gate / create modal unchanged (real APIs)  
15. Local cache only when policy allows  
16. Premium hub keyboard  
17. Suggested join chips use tokens  
18. Error retry does not invent communities  
19. Documented dual surface: directory + hub  
20. Group chat remains member space (not private DMs)

## Files

- `components/ghc/communities-screen.tsx`
- `components/ghc/premium-community-hub.tsx`

## Safety

- No invented communities, members, or messages  
- Server directory authoritative when available  
- Chat ≠ Messages (DMs) — product boundary preserved  
