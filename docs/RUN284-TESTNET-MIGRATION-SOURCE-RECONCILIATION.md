# Run #284 — Testnet Applied Migration Source Reconciliation

**Audit date:** 2026-11-11  
**Project:** `tpckwgdsjlkzscjlxiwe` (Testnet)
**Live applied entries:** 39
**Exact filename/version sources present:** 10
**Exact sources missing or version-mismatched:** 29

This comparison is exact on `(version, name)` and deliberately does not treat a same-purpose migration under a different timestamp as the same source. The current archive manifest has 220 local migration files, but that does not prove they match the live applied history. Restore the exact applied SQL and verify checksums before clean-database rehearsal or further migration work.

| Applied version | Applied name | Exact source |
|---|---|---|
| `20261110085225` | `phase7_durable_community_governance_reconciliation` | MISSING / VERSION MISMATCH |
| `20261110085344` | `withdrawal_rpc_acl_and_recovery_atomicity` | MISSING / VERSION MISMATCH |
| `20261110085351` | `wallet_recovery_reset_lock_race_guard` | MISSING / VERSION MISMATCH |
| `20261110091735` | `phase1_curation_community_guard_reconciliation` | MISSING / VERSION MISMATCH |
| `20261110092119` | `server_only_security_definer_rpc_acl_hardening` | MISSING / VERSION MISMATCH |
| `20261110092226` | `function_search_path_hardening` | MISSING / VERSION MISMATCH |
| `20261110092347` | `remove_verified_duplicate_indexes` | MISSING / VERSION MISMATCH |
| `20261110092407` | `remove_verified_duplicate_indexes` | MISSING / VERSION MISMATCH |
| `20261110093142` | `rls_policy_dedup_and_initplan_optimization` | MISSING / VERSION MISMATCH |
| `20261110093227` | `rls_policy_dedup_and_initplan_optimization` | MISSING / VERSION MISMATCH |
| `20261110093228` | `supporting_foreign_key_indexes` | MISSING / VERSION MISMATCH |
| `20261110102610` | `marketplace_orders_list_rpc_alias_fix` | MISSING / VERSION MISMATCH |
| `20261110174922` | `revoke_client_table_write_and_sequence_privileges` | Present |
| `20261110182120` | `community_chat_membership_revocation_and_reconciliation` | Present |
| `20261110183004` | `community_server_filter_search_reconciliation` | Present |
| `20261110185525` | `story_idempotent_create_and_owned_media_guard` | Present |
| `20261110185528` | `story_read_path_and_viewer_roster_indexes` | Present |
| `20261110190531` | `post_create_idempotent_owner_and_payload_guard` | Present |
| `20261110193134` | `social_feed_profile_rpc_search_path_hardening` | Present |
| `20261110200232` | `social_relationship_messaging_rpc_search_path_hardening` | MISSING / VERSION MISMATCH |
| `20261110200251` | `gh_messaging_call_sessions` | MISSING / VERSION MISMATCH |
| `20261110200634` | `connection_accept_block_guard` | MISSING / VERSION MISMATCH |
| `20261110201255` | `gh_call_answer_after_accept` | MISSING / VERSION MISMATCH |
| `20261110201424` | `gh_call_signal_retention_cleanup` | MISSING / VERSION MISMATCH |
| `20261110202506` | `gh_call_incoming_global_listener` | MISSING / VERSION MISMATCH |
| `20261110203513` | `gh_relationship_block_pair_serialization` | MISSING / VERSION MISMATCH |
| `20261110203743` | `gh_follow_pair_serialization` | MISSING / VERSION MISMATCH |
| `20261110212304` | `discovery_candidates_and_atomic_dm_create` | MISSING / VERSION MISMATCH |
| `20261110212346` | `atomic_dm_identity_profile_source_fix` | MISSING / VERSION MISMATCH |
| `20261110212932` | `call_signal_membership_and_volume_guard` | MISSING / VERSION MISMATCH |
| `20261110213416` | `relationship_privacy_server_guards` | MISSING / VERSION MISMATCH |
| `20261110213431` | `block_revokes_accepted_connections` | MISSING / VERSION MISMATCH |
| `20261110213745` | `relationship_context_counts_as_mutual` | MISSING / VERSION MISMATCH |
| `20261110215928` | `relationship_block_revoke_pair_guard` | MISSING / VERSION MISMATCH |
| `20261111063228` | `call_transition_membership_block_atomicity` | MISSING / VERSION MISMATCH |
| `20261111064321` | `call_pair_lock_order_and_retry_safety` | Present |
| `20261111064446` | `call_expiry_sweeper_before_start` | Present |
| `20261111064542` | `call_expiry_sweeper_pair_lock_order` | Present |
| `20261111114429` | `run284_call_history_participant_indexes` | MISSING / VERSION MISMATCH |
