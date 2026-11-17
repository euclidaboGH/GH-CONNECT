# UPGRADE-WORKLOG 0.338.84

## Blocking fix
- Phase 10 release closure required `needs: static` (exact string). CI workflow used `needs: [static]`.
- Fixed to `needs: static`. Phase 10 closure **16/16**; Run #300 **20/20**.

## 50 safe improvements (feed / home / profile / community / post cards & buttons)

### Feed (F01–F20)
1. Tighter list vertical rhythm (0.5rem mobile / 0.75rem desktop).
2. `content-visibility: auto` on feed post slots with intrinsic size hint.
3. Toolbar hairline uses FB token colour.
4. Toolbar tabs/buttons min 44px touch targets.
5. Skeleton cards use post-card radius token.
6. Loading status padding balanced.
7. Feed scroll `scroll-padding-top` for sticky toolbar.
8. Overscroll contain on feed scroll.
9. Soft background transition on cards (disabled under reduced-motion).
10. Reduced-motion disables pab burst/pop animations.
11. Header gap tightened.
12. Author name ellipsis on overflow.
13. Mobile media edge-to-edge; sm+ rounded gallery.
14. Video max-height capped for feed density.
15. Reaction summary min-height for layout stability.
16. Social reaction tray pill shape, softer shadow.
17. Skeleton spacing matches live list rhythm.
18. Skeleton uses `gh-post-card` class for chrome parity.
19. Error copy remains honest (“not an empty feed”).
20. Feed shell keeps offline preservation messaging.

### Post actions / buttons (F21–F30)
21. Action dock hairline separators (quality vs respond).
22. Tap-highlight disabled on vote/respond buttons.
23. Disabled vote buttons show not-allowed cursor.
24. Respond row min-height 44px.
25. Respond label letter-spacing tightened.
26. Active vote buttons use heavier weight.
27. Quality vote group non-shrinking.
28. Soft respond buttons flex evenly in 3-col grid.
29. Phase 16 “Community curation” aria-label retained.
30. Focus-visible rings standardized on social surfaces.

### Profile (P01–P10)
31. Profile header bottom hairline.
32. Section tablist horizontal scroll without scrollbar chrome.
33. Tabs min-height 44px, nowrap labels.
34. Selected tab underline / weight via CSS + existing emerald pill.
35. Profile post cards 0.5rem bottom spacing.
36. Posts panel respects bottom nav inset.
37. Profile shell class retained for CSS hooks.
38. Section tabs keyboard arrows retained.
39. Stats row remains real-count-only.
40. Own posts reuse EnhancedPostCard surface=profile.

### Community (C01–C10)
41. Communities/hub tablists consistent gap.
42. Tabs min-height 44px + semibold.
43. Directory/card hairline border + FB radius.
44. Hover border soft primary tint.
45. Hub posts spacing aligned to feed rhythm.
46. Load-more CTAs styled with min-height / bold weight in CSS.
47. Communities shell class retained.
48. Join honesty (Request vs Join) retained.
49. Member grammar / directory durability retained.
50. Community posts still go through EnhancedPostCard surface=community.

## Identity
package / lock / APP_RELEASE / VERIFIED_MANIFEST / PROJECT_TRUTH / SOURCE_OF_TRUTH → `0.338.84`.

## Notes
Source-only visual/a11y/density. No financial authority, migration, or production approval changes. Production remains **NOT APPROVED**.
