# Run #278 — Supabase migration source drift (2026-11-11)

**Target:** GH Connect Testnet `tpckwgdsjlkzscjlxiwe`  
**Method:** Read-only inspection of `supabase_migrations.schema_migrations` and the source archive's `supabase/migrations` directory.  
**No SQL was applied by this audit.**

## Finding

The active Testnet migration history contains 38 records from 2026-11-10 onward. The source archive's migration directory did not contain the complete applied social/call history. Three latest call migrations were restored from the database's stored statement text into the repository. Sixteen applied records still have no matching source migration file.

## Restored from Testnet history

| Version | Name | Source file | Status |
|---|---|---|---|
| `20261111064321` | `call_pair_lock_order_and_retry_safety` | `20261111064321_call_pair_lock_order_and_retry_safety.sql` | Restored verbatim; Testnet applied |
| `20261111064446` | `call_expiry_sweeper_before_start` | `20261111064446_call_expiry_sweeper_before_start.sql` | Restored verbatim; superseded by next migration |
| `20261111064542` | `call_expiry_sweeper_pair_lock_order` | `20261111064542_call_expiry_sweeper_pair_lock_order.sql` | Restored verbatim; Testnet applied |

All three are `REVIEW_REQUIRED` in the source inventory and marked `APPLIED_TESTNET_ONLY_HOLD_OTHER_TARGETS` in the review order. They are not permission to replay or push them.

## Still missing from source archive

| Version | Applied migration name |
|---|---|
| `20261110200232` | `social_relationship_messaging_rpc_search_path_hardening` |
| `20261110200251` | `gh_messaging_call_sessions` |
| `20261110200634` | `connection_accept_block_guard` |
| `20261110201255` | `gh_call_answer_after_accept` |
| `20261110201424` | `gh_call_signal_retention_cleanup` |
| `20261110202506` | `gh_call_incoming_global_listener` |
| `20261110203513` | `gh_relationship_block_pair_serialization` |
| `20261110203743` | `gh_follow_pair_serialization` |
| `20261110212304` | `discovery_candidates_and_atomic_dm_create` |
| `20261110212346` | `atomic_dm_identity_profile_source_fix` |
| `20261110212932` | `call_signal_membership_and_volume_guard` |
| `20261110213416` | `relationship_privacy_server_guards` |
| `20261110213431` | `block_revokes_accepted_connections` |
| `20261110213745` | `relationship_context_counts_as_mutual` |
| `20261110215928` | `relationship_block_revoke_pair_guard` |
| `20261111063228` | `call_transition_membership_block_atomicity` |

## Required next action

Restore the exact SQL statements for each missing record from `supabase_migrations.schema_migrations.statements`, preserving the original version/name. Then run dependency analysis, clean-database rehearsal and idempotency/partial-failure tests. Compare every source version against the Testnet history and investigate extra, missing or divergent versions. Do not run `supabase db push`, `migration repair`, or replay the restored migrations on the active Testnet. Mainnet was not accessed.
