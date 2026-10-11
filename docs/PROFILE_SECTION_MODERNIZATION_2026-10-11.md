# Profile — surgical modernization (2026-10-11)

## Twenty maintenance areas addressed

1. Offline banner for profile edits  
2. Escape closes photo sheet / edit modal  
3. Activity tablist keyboard (←/→)  
4. Tab roles + roving tabindex  
5. Focus rings on tabs  
6. Brand token on avatar camera badge  
7. Brand token on active tab underline  
8. Larger wallet/settings touch targets  
9. SR status on profile save  
10. Post list count (real data only)  
11. Posts list semantics  
12. Media empty honesty  
13. Media list semantics  
14. Media tab auto-fallback when no media  
15. Empty posts → compose CTA (kept)  
16. Interests empty → edit CTA (kept)  
17. Real profile fields only — no invented bio/stats  
18. GH ID from identity domain (kept)  
19. Photo/cover sheet a11y (kept + Escape)  
20. Documented product boundary  

## Files

- `components/ghc/profile-screen.tsx`

## Safety

- No fabricated profile fields, posts, or verification  
- `updateProfile` remains the write path  
- Offline copy does not claim server durability  
