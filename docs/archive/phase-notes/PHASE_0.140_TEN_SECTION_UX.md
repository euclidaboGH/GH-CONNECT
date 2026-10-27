# 0.140.0 — Ten section UX / stability upgrades

1. **Feed / post cards** — Removed duplicate top "0 views" row; views only in Curation & post insights. Collapsed insights shows "Insights" when views are 0.
2. **Feed performance** — `content-visibility: auto` on post slots and CSS contain-intrinsic-size.
3. **Messaging** — Send control exposes `aria-busy` while disabled/sending.
4. **Notifications** — Empty/refresh paths retained; list render left as-is (no fragile map rewrite).
5. **Marketplace** — Card slot CSS for offscreen layout skip; safer order error handling paths retained.
6. **Community** — LazyImage covers retained.
7. **Discover** — Grid children use content-visibility for scroll performance.
8. **Matches / social** — Existing revalidate paths retained.
9. **Profile** — Pioneer strip can hide duplicate GreenHaven ID when hero already shows the canonical ID.
10. **Shell / offline** — Offline banner is a fixed pill overlay (does not push headers down).

Also retained: daily claim body-portaled FAB, wallet history sheet, public legal routes.
