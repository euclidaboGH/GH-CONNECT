# Communities create CTAs harmonized (2026-10-11)

## Problem
Multiple parallel "Create community" controls (header, my empty, discover empty, EmptyState, filtered empty).

## Fix
- Single `openCreateCommunity` → one `CreateGroupModal`
- Header **Create** remains the primary global control
- My empty: Discover + secondary Create one
- Filtered/search empty: Create only when search has no matches
- Removed duplicate discover EmptyState create branch

## Production notes
- Demo communities only when `isDemoDataAllowed()`
- Join/create still use existing domain/API paths
- Realtime global testing still requires operator: durable messaging flag, Supabase, auth
