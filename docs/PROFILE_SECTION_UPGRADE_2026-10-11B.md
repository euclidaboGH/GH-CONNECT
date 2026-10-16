# Profile upgrade (2026-10-11B)

## Five missing parts added

1. **Profile completion** strip (real `calculateProfileCompletion` only)  
2. **Extra photo gallery** from `photos[1…]` (no placeholders)  
3. **Copy GH ID** control  
4. **Education / hometown** when present on profile  
5. **Open post** from activity list when `post.id` exists  

## Twenty maintenance areas

1. Offline photo pick notice  
2. Status on photo/cover update  
3. Completion → Edit  
4. Gallery opens photo sheet  
5. Copy ID a11y  
6. Hometown line  
7. Education line  
8. Post deep-link attempt  
9–20. Prior offline, Escape, tabs, tokens, cards, counts retained  

## Safety

- No fabricated completion fields beyond measuring real profile  
- No fake photos  
- Open-post only with real id  
