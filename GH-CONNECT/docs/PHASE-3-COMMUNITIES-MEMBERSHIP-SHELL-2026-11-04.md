# Phase 3 — Communities membership + shell

**Baseline:** Phase 2 social polish  
**Date:** 4 November 2026  

## Problem

`My (1)` could show a count while the list looked empty: public directory RPC does not mark membership, and session join markers were demo-gated.

## Fixes

1. **Migration** `20261104180001_gh_community_list_memberships_viewer.sql`  
   - `gh_community_list_memberships(p_user_id, p_limit)` — active memberships for viewer  
   - `service_role` execute only  

2. **GET `/api/communities`**  
   - When authenticated, merge memberships → `viewerIsMember`, `members`, `groupRoles`  
   - Append private/invite communities the user belongs to  

3. **Client**  
   - Map `viewerIsMember` into domain membership fields  
   - Session storage for joined IDs (always); durable local only when demo policy allows  
   - Default directory tab: **My**  
   - Discover-only category/privacy chips; My keeps sort only  
   - Member count grammar: “1 member” / “N members”  
   - Shell `overscroll-y-contain` for smoother scrolling  

## Operator

Apply migration on Testnet **after review**. Until applied, public list still works; My tab relies on `createdBy` / session markers / conversation state.

## Verify

```bash
node scripts/check-phase3-communities-membership-shell-2026-11-04.mjs
```
