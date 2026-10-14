# Feed + Profile premium / production upgrades (2026-10-14)

Baseline: Professional-UI-Polish (harmonized)

## Feed (1–20)
1–4. PremiumSurfaceActions header (retained)
5–8. open-post: smooth scroll + emerald highlight ring
9–10. data-post-id on post articles for deep-link targeting
11–12. Feed filter persistence (retained)
13–15. Rank impressions auth path (retained)
16–17. Pull-to-refresh + skeleton bootstrap (retained)
18–19. Honest empty state (no fake posts)
20. Production ranking via rankFeed (retained)

## Profile (21–35)
21–22. PremiumSurfaceActions on profile header (Marketplace + Ecosystem)
23–25. Escape closes Dashboard / library / social list sheets
26–28. Dashboard sheet for tools (not littered under posts) (retained)
29–30. Content library entry (retained)
31–32. Owner timeline uses OwnPostCard → same feed action routes
33–34. Offline banner copy refined
35. Profile posts list aria-label clarity

## Stories / messages / reward / wallet (36–50)
36–37. Story blob: blocked before publishStory
38–39. Messaging send retry helper (retained if present)
40–42. Curation offline guard + debounce
43–45. Post reward panel session path (retained)
46–48. Wallet claim auth + credentials (retained)
49. Reputation badge (retained)
50. Scoped unauthed economy/social fetch scan: 0

## Safety
No ledger, RLS, ranking-algorithm, or fabricated balance changes.
