# Post curation dashboard upgrade

The expandable post curation section now combines engagement and server-reported reward analytics in a responsive dashboard.

## Included
- View count, upvotes, downvotes, and net vote count, including when the reward state is inactive or no reward record exists.
- Reward total, author reward, curation reward, upvote impact, downvote impact, and net impact when a server-confirmed reward state is active.
- Reward status labels distinguish accruing, finalized, settled, inactive, and voided states.
- The author/curation percentage bar is derived from the actual author and curation values returned for that post; it does not assume or overwrite a per-post server policy.
- Refreshes reward data on `ghc:content-reward-updated`.
- Inactive rewards are shown as not yet accruing instead of inventing earnings or implying that votes mint GHC.

## Authority and verification boundary
The public reward API and system-written `gh_content_rewards` projection remain the source of reward values. This UI does not calculate, credit, settle, or mint GHC. View counts are sourced from the feed post's current `engagement.views` value; they are not independently counted by this panel. Verify the actual post-view telemetry and reward projection against the deployed Testnet database before treating values as complete live analytics.

## Curation channel wiring follow-up
- Every durable curation vote now emits a post-specific reward refresh signal, including votes where no GHC was credited or redistributed. This keeps vote totals and the reward projection synchronized without implying a payout.
- The panel listens to the shared `ghc:post-engagement` bus and `ghc:content-reward-updated`, then refreshes the server reward projection and the authenticated `/insights` read model.
- View and qualified-view counts prefer the server aggregate (`gh_post_attention_summary`) when available. Feed-provided view counts are a fallback only; qualified views are shown separately and never added to total views.
- A manual refresh action is available in the expanded panel. Read failures are non-fatal and preserve the last confirmed values.
- The panel uses the same cookie/session and `IdentityService` headers as the app's authenticated API calls. The insights route retains its server-side author/public-post visibility checks. No client-provided user ID, reward amount, or vote weight is trusted.

## Remaining live verification
Run the Testnet smoke tests with two authenticated accounts: author and non-author on a public post; private post author and non-author; one upvote and one downvote; a vote with no GHC movement; funded reward state; inactive reward state; refresh after a vote; and view/qualified-view counters after dwell time. Confirm private posts return no insights to non-authors and the reward read model never exposes private curator calibration or vote weights.
