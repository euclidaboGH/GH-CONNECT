# Run 273 — Discovery, messaging & direct calls

## Direct call controller
- State machine: idle → outgoing_ringing → connecting → in_call / failed / ended
- Never hangs: CALL_RING_TIMEOUT_MS + non-enabled auto-fail path (~2.4s)
- Relationship required: friend | match
- Media tracks stopped on end
- Sheet shows honest copy when signaling/TURN absent

## Messaging
- ChatHeader onCall / onVideo wired for non-community threads
- Bridge maps friends/matchIds/blocks from GHC context

## Discover / Matches
- CTA hierarchy Message vs Connect vs Respond
- Empty-after-filters copy

## Database
- gh_call_sessions remains PROPOSAL under supabase/proposals/
