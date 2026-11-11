# GreenHaven — 41-module filter and discovery UX audit

**Source baseline:** `GREENHAVEN-0.338.53-DAILY-REWARDS-PREMIUM-UX-UPGRADE-2026-11-11.zip` (current 0.338.53 source derivative).

**Registry facts:** 41 services across 9 categories: 11 Active and 30 Coming Soon. Coming Soon entries remain informational-only; this plan does not create fake product screens or change release status.

## Research-backed design rules

- Keep search, filtering, and sorting distinct. Expose the highest-value facets first; place less-used facets behind a clear “More filters” affordance.
- Use immediate updates only for fast local data. Use a staged Apply / Show results flow on mobile or slower remote queries to avoid repeated expensive requests and accidental taps.
- Preserve focus and scroll context during refinement; announce result counts without unexpectedly moving focus.
- Show facet counts only when authoritative. Provide an explicit recovery path from zero results and a one-action clear/reset.
- Persist only non-sensitive preferences, scoped to the authenticated account. Validate restored values and reset safely on account changes.
- For large datasets, apply authorized server-side filtering before pagination. Client filtering is presentation logic, never an authorization boundary.
- Whitelist sort keys server-side and bound query, date, numeric range, cursor, and page-size inputs. Abort or fence stale requests.
- Use responsive filter trays/sheets on mobile, not squeezed desktop sidebars; provide comfortable touch targets, keyboard operation, visible focus, reduced motion, and screen-reader labels.
- Do not expose private profile, location, financial, or relationship data through facets or counts. Never compare GHC and Pi amounts on one numeric scale.

## Per-service filter blueprint

| Service | Registry state | Recommended service-specific facets |
|---|---|---|
| Community (`community`) | ACTIVE | Member role · membership state · location · activity · event type |
| GH Chat (`gh-chat`) | ACTIVE | Unread state · conversation type · pinned · muted · attachment type · date |
| Connections (`connections`) | ACTIVE | Request direction · relationship state · mutual connections · location |
| Matches (`matches`) | ACTIVE | Match intent · distance/radius · shared interests · freshness · eligibility (server-authoritative) |
| Events (`events`) | COMING SOON | Event type · date/time · location · format · availability · host |
| Marketplace (`marketplace`) | ACTIVE | Category · listing type · currency-specific price · availability · delivery · location · seller |
| Seller Centre (`seller-centre`) | COMING SOON | Listing state · inventory health · category · fulfilment · moderation status |
| Orders (`orders`) | ACTIVE | Buyer/seller role · order lifecycle · payment state · fulfilment · date · dispute status |
| Services (`services-ip`) | COMING SOON | Service category · provider location · availability · price range · verification |
| Intellectual Marketplace (`intellectual-marketplace`) | COMING SOON | Asset type · licence · creator · price currency · availability · verification |
| GH Education (`education`) | COMING SOON | Level · subject · learning mode · language · accreditation · availability |
| Primary (`primary-edu`) | COMING SOON | Grade · subject · curriculum · language · learning format |
| Secondary (`secondary-edu`) | COMING SOON | Grade · subject · curriculum · examination track · learning format |
| Tertiary (`tertiary-edu`) | COMING SOON | Institution · qualification · field · study mode · admission cycle |
| GH Scholars Hub (`scholars-hub`) | COMING SOON | Scholarship type · eligibility · deadline · institution · study level |
| Courses (`courses`) | COMING SOON | Subject · level · duration · delivery mode · language · instructor |
| Transport (`transport`) | COMING SOON | Mode · origin · destination · departure window · availability · accessibility |
| Road (`road`) | COMING SOON | Route · operator · departure time · fare · amenities · availability |
| Rail (`rail`) | COMING SOON | Route · station · departure window · class · fare · availability |
| Air (`air`) | COMING SOON | Origin · destination · date · airline · cabin · fare · baggage |
| Sea (`sea`) | COMING SOON | Port · route · vessel type · departure date · cabin · availability |
| Logistics (`logistics`) | COMING SOON | Shipment state · origin/destination · service level · carrier · delivery window |
| Hotels (`hotels`) | COMING SOON | Destination · dates · price · rating · amenities · property type · availability |
| Accommodation (`accommodation`) | COMING SOON | Location · stay dates · property type · price · facilities · host rating |
| Reservations (`reservations`) | COMING SOON | Date/time · party size · location · venue type · availability · accessibility |
| Travel (`travel`) | COMING SOON | Destination · dates · trip type · budget · duration · travel mode |
| Wallet (`wallet`) | ACTIVE | Asset · transaction type · direction · status · date range · counterparty |
| GHC (`ghc`) | ACTIVE | Ledger event · maturity state · transaction status · date · source · reference |
| Pi Payments (`pi-payments`) | ACTIVE | Payment status · purpose · date · network label · verified reference (never controls network authority) |
| Rewards (`rewards`) | ACTIVE | Reward source · lifecycle status · maturity · mission · date · amount band |
| Membership (`membership`) | ACTIVE | Tier · entitlement group · lifecycle state · renewal window · payment status |
| Charity (`charity`) | COMING SOON | Cause · impact area · location · campaign status · verification · date |
| Causes (`causes`) | COMING SOON | Impact category · geography · campaign state · organization · evidence status |
| Donations (`donations`) | COMING SOON | Cause · campaign · date · payment status · receipt state · currency (never mix scales) |
| Community projects (`community-projects`) | COMING SOON | Project category · location · progress state · funding status · organizer |
| Entertainment (`entertainment`) | COMING SOON | Media type · genre · language · duration · creator · release date |
| Creator tools (`creator-tools`) | COMING SOON | Tool category · content format · publication state · performance window · eligibility |
| Digital content (`digital-content`) | COMING SOON | Content type · topic · language · creator · licence · publication date |
| OpenMind AI (`openmind-ai`) | COMING SOON | Capability · task type · modality · access tier · privacy/data handling |
| AI Search (`ai-search`) | COMING SOON | Content type · source · date · language · relevance · safe-search setting |
| Knowledge services (`knowledge`) | COMING SOON | Topic · format · level · language · source quality · updated date |

## Implementation status and safe rollout

- **Implemented in this tranche:** upgraded shared active-filter summary and loading/error/empty/no-results states; improved the ecosystem directory to filter all 41 registry entries by category and availability, search service metadata, sort A–Z or featured, expose active-filter chips, announce result counts, and clear all filters.
- **Existing live filter surfaces identified for migration:** Community, Feed, Activity, GH Chat/Messages, Discovery, Notifications, Rewards, Marketplace, and Wallet. Other Active surfaces—Orders, Wallet, GHC, Pi Payments, and Membership—need their own domain-specific audit before introducing new facets.
- **Coming Soon services:** blueprint only. Do not render working filters, expose data, activate routes, or change `COMING_SOON` status until a real canonical data contract and separately approved launch exist.
- **Performance requirements:** memoize deterministic local transforms; avoid repeated filtering/sorting of the same collection; debounce remote text queries; abort/fence stale requests; use server pagination and bounded result sizes; virtualize long lists.
- **Financial safety:** wallet/GHC/rewards/Pi filters are read-only views over server-confirmed records. Filters must never create, mutate, authorize, settle, or reconcile transactions.
- **Release limitation:** this is a shared UX foundation and ecosystem-directory implementation, not proof that all 41 service screens are live or every per-service facet is implemented. Each Active screen needs its own integration/regression pass; Coming Soon screens require future implementation.
