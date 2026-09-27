# GH Content Attention — Phase 2.1 Specification

**Status:** Implemented (source verified; Testnet E2E pending)
**Product:** GreenHaven  
**Depends on:** Authenticated session, durable posts (`gh_posts`), Phase 1 social actions  
**Does not implement:** Ranking algorithms, reputation, curation power, GHC rewards, Pi Ads  

---

## 1. Purpose

Define **durable, server-side content attention signals** so GreenHaven can later build ranking and quality systems on verified engagement—not on client-claimed counters.

Attention answers:

> Did a real authenticated user meaningfully encounter this content, and under what conditions?

It does **not** answer:

> How much GHC should this earn?

---

## 2. Non-goals (hard rules)

Attention events **MUST NOT**:

- Mint, credit, or spend GHC  
- Create or settle Pi  
- Change wallet balances  
- Create reputation points or level-ups  
- Create Curation Power  
- Create creator earnings or tip pools  
- Create advertising rewards  
- Accept client-supplied totals as authoritative counts  
- Accept client-supplied `userId` / actor identity  

Any future economy that uses attention must be a **separate** phase with its own anti-abuse and ledger rules.

---

## 3. Existing architecture (discovered)

| Object | Location | Relevance |
|--------|----------|-----------|
| `gh_posts` | `20260923_gh_social_core.sql` | Has `like_count`, `comment_count`, `share_count`. **No `view_count`.** |
| `gh_saves` + `gh_save_toggle` | Same migration | Durable **save** already exists (user × post). |
| `gh_story_views` + `gh_story_view` | Same migration | Per-viewer story views (PK story_id, viewer_id). |
| Reactions / comments / follows | Phase 1 | Separate social graph actions—not attention events. |
| `PostInsightsSheet` / profile `viewCount` | UI components | Display-oriented; **not** a durable post-view ledger. |
| Feed RPC | `gh_post_list_feed` | Returns likes/comments/shares; no view field. |

### Duplication policy

| Signal | Recommendation |
|--------|----------------|
| **save** | **Reuse** `gh_saves` / `gh_save_toggle`. Do **not** insert parallel “save attention” rows for the same action. Optional: emit a derived attention marker only if analytics needs a unified event stream (see §7). |
| **share** | Prefer **reuse/extend** existing `share_count` + share API path if present; do not invent a second share table. |
| **view / qualified_view / complete** | **New** durable store required—posts currently lack view persistence. Prefer one table for event types rather than three tables. |
| **Story views** | Keep `gh_story_views` for stories; do not fold stories into post attention without a product decision. |

**Risk:** Dual-writing “save” to both `gh_saves` and a new events table without a single writer path can diverge. Prefer one writer for saves.

---

## 4. Event types (Phase 2)

### 4.1 `view`

| Field | Definition |
|-------|------------|
| **Meaning** | Content was presented to the user long enough to count as an impression (feed card visible / detail opened). |
| **Eligibility** | Authenticated user; post exists and not deleted; viewer allowed by visibility/block rules. |
| **Actor** | Session-derived `userId` only. |
| **Target** | `post_id` (text, FK logical to `gh_posts.id`). |
| **Dedup / window** | At most **one `view` per (user, post) per calendar day (UTC)** *or* sliding **N-hour window** (recommend **6 hours** for v1). Repeat opens in-window update `last_seen_at` only—do not increment unbounded. |
| **Timestamp** | Server `now()` on first accept in window; optional `last_seen_at`. |
| **Does NOT mean** | Quality, preference, completion, or reward eligibility. |

**Abuse:** Rapid feed scroll can still generate views—cap by window; optional global per-user hourly max later.

---

### 4.2 `qualified_view`

| Field | Definition |
|-------|------------|
| **Meaning** | Stronger signal than `view`: user remained with content for a **minimum dwell** or scrolled meaningful depth. |
| **Eligibility** | Same as `view`, plus client reports dwell ≥ threshold **and** server accepts only within rate limits. |
| **Suggested threshold (product)** | ≥ **3 seconds** dwell on post detail **or** ≥ **50%** of text/media viewport time (exact numbers tunable; server stores threshold version in metadata). |
| **Actor** | Session only. |
| **Dedup / window** | At most **one `qualified_view` per (user, post) per 24 hours**. |
| **Does NOT mean** | Full completion, endorsement, or payment. |

**Abuse:** Client can lie about dwell. Mitigation: rate limits, impossible dwell rejection (e.g. dwell > session age), no economic value in Phase 2 so incentive is low.

---

### 4.3 `complete`

| Field | Definition |
|-------|------------|
| **Meaning** | User finished the primary media/content unit (e.g. video ended, article scrolled to end). |
| **Eligibility** | Media/long-form posts primarily; optional for short text (define as “expanded + dwell ≥ T”). |
| **Actor** | Session only. |
| **Dedup** | At most **one `complete` per (user, post)** lifetime *or* per major edit version (if `is_edited` / content hash tracked later). Recommend **one per (user, post)** for v1. |
| **Does NOT mean** | Like, tip, or reward. |

---

### 4.4 `save`

| Field | Definition |
|-------|------------|
| **Meaning** | User bookmarked the post for later (existing product behavior). |
| **Eligibility** | Phase 1 rules via `gh_save_toggle`. |
| **Actor** | Session only. |
| **Dedup** | Table PK / unique (user_id, post_id)—toggle on/off. |
| **Implementation** | **Existing durable path only.** Attention layer may *read* saves for ranking later; it must not replace `gh_saves`. |
| **Does NOT mean** | Public endorsement equal to a reaction. |

---

### 4.5 `share`

| Field | Definition |
|-------|------------|
| **Meaning** | User initiated a share/repost/external share action recognized by GreenHaven. |
| **Eligibility** | Authenticated; post shareable under visibility rules. |
| **Actor** | Session only. |
| **Dedup** | Product choice: count each successful share action **or** one per day per post. Prefer **server-confirmed share events** with idempotency key per UI action. |
| **Implementation** | Prefer extending existing `share_count` maintenance path; optional event log row for analytics. |
| **Does NOT mean** | Viral success or paid distribution. |

---

## 5. Actor & authorization

```text
Client → API (cookie/session) → resolveAuthenticatedUser → actorId
→ validate post + visibility + blocks
→ write durable attention
```

- **Never** trust `body.userId`, `body.viewerId`, or spoofed counts.  
- **Service-role** only for DB writes (same pattern as other social RPCs).  
- RLS: deny direct client table access (`USING (false)`).  

### Privacy

- View graphs are sensitive. Default: **only the post author** (and operators under ops policy) may read **aggregate** counts; raw viewer lists are not exposed to arbitrary clients.  
- Public APIs may return **aggregate** `viewCount` / `qualifiedViewCount` on owned posts only, or coarse public totals later—product decision.

---

## 6. Proposed persistence shape (future implementation — not now)

**Preferred:** single additive table, e.g. `gh_post_attention`:

| Column | Notes |
|--------|--------|
| `post_id` | text NOT NULL |
| `user_id` | text NOT NULL |
| `event_type` | `view` \| `qualified_view` \| `complete` (save/share optional) |
| `window_key` | text NOT NULL — e.g. `2026-09-25` or `2026-09-25T12` for dedup |
| `created_at` / `updated_at` | timestamptz |
| `metadata` | jsonb — client version, dwell_ms (capped), content_type |
| **PK** | `(post_id, user_id, event_type, window_key)` |

Optional denormalized counters on `gh_posts` (`view_count`, `qualified_view_count`) updated only inside SECURITY DEFINER RPCs—never by the client.

**RPC sketch (future):** `gh_attention_record(p_post_id, p_user_id, p_event_type, p_window_key, p_metadata)`  
- Validates allowlist event types  
- Enforces dedup via PK / `ON CONFLICT`  
- Returns `{ ok, recorded, eventType }`  
- **Zero** ledger calls  

---

## 7. Unified event stream (optional)

If product wants one analytics firehose:

- **Source of truth** for saves remains `gh_saves`.  
- A trigger or application dual-write to `gh_post_attention` is optional and must be documented.  
- Phase 2.1 **does not require** dual-write; ranking can join `gh_saves` later.

---

## 8. Ranking relationship

Attention rows are **raw signals** for a future ranking pipeline (Phase 3+).

Phase 2.1:

- Does **not** define ranking formulas  
- Does **not** change feed order  
- Does **not** weight votes by wallet balance  

Future ranking may combine: reactions, attention, graph proximity, freshness, abuse scores—under server authority.

---

## 9. API surface (future implementation notes)

Suggested (not built in this task):

```http
POST /api/social/posts/:id/attention
Authorization: session
Body: { "eventType": "view" | "qualified_view" | "complete", "dwellMs"?: number, "idempotencyKey"?: string }
```

Rules:

- Rate limit per user  
- Ignore unknown event types  
- Cap `dwellMs` (e.g. max 600000)  
- No GHC fields accepted  

`save` / `share` continue on existing endpoints.

---

## 10. Client behavior (future)

- Feed: fire `view` when card meets visibility threshold (Intersection Observer).  
- Detail: upgrade to `qualified_view` after dwell.  
- Video: `complete` on ended (with anti-spam).  
- Optimistic UI: **do not** show fake global view counts from local increments without server ack.  
- Failure: silent or retry; never invent wallet effects.

---

## 11. Acceptance criteria (when Phase 2 is coded)

1. Authenticated `view` persists and survives reload within dedup rules.  
2. Unauthenticated requests rejected.  
3. Spoofed actor id ignored.  
4. No ledger/wallet rows created.  
5. Save still uses `gh_saves` only.  
6. Feed functions if attention table empty.  
7. RLS blocks client direct reads/writes.

---

## 12. Unresolved design questions

1. **Dedup window for `view`:** calendar day vs 6-hour sliding—pick before migration.  
2. **Public vs author-only aggregates** for view counts.  
3. **Whether `share` writes an attention row** or only increments `share_count`.  
4. **Anonymous impressions:** out of scope (auth required for v1).  
5. **Community-scoped posts:** same attention table with `community_id` in metadata or filter via post row.  
6. **Backfill:** none; start from deploy forward.  
7. **Alignment with profile `viewCount` UI:** treat as non-authoritative until wired to server aggregates.

---

## 13. Document control

| Version | Note |
|---------|------|
| 2.1.0 | Spec-only; grounded in current `gh_posts` / `gh_saves` / `gh_story_views` |

**Next engineering step (separate prompt):** Phase 2.2 migration + RPC + API — only after this spec is approved and Testnet capacity allows.
