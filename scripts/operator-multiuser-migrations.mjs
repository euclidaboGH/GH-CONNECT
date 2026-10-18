#!/usr/bin/env node
/**
 * Operator: ordered multi-user migrations + required SQL definition scan (no DB write).
 * ON_DISK / MISSING / INCONSISTENT for files. APPLIED is always UNKNOWN without DB access.
 */
import { readdirSync, readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const migDir = join(root, "supabase", "migrations")

const MULTIUSER_CRITICAL = [
  { file: "20260905_connection_request_intents.sql", class: "REQUIRES_APPROVAL", why: "Connection requests inbox", mustContain: ["ghc_connection_request_upsert", "ghc_connection_request_accept"] },
  { file: "202609120001_marketplace_listings_and_list_rpc.sql", class: "REQUIRED", why: "Shared marketplace catalog", mustContain: ["gh_marketplace"] },
  { file: "202609190001_gh_messaging_durable.sql", class: "REQUIRED", why: "Cross-device DMs", mustContain: ["gh_conversations", "gh_messages"] },
  { file: "202609190002_gh_user_profiles_and_progress.sql", class: "REQUIRED", why: "Profile durability", mustContain: ["gh_user_profiles"] },
  { file: "202609230003_gh_communities_core.sql", class: "REQUIRED", why: "Communities core", mustContain: ["gh_communities"] },
  { file: "202609230006_gh_social_core.sql", class: "REQUIRED", why: "Social core posts/follows/comments", mustContain: ["gh_posts", "gh_follow_set", "gh_comment_create", "gh_post_create"] },
  { file: "202609250002_gh_post_list_feed_order_fix.sql", class: "REQUIRED", why: "Feed list ordering", mustContain: ["gh_post_list_feed"] },
  { file: "202609260002_gh_reaction_multi_type.sql", class: "REQUIRED", why: "Durable likes (gh_reaction_toggle)", mustContain: ["gh_reaction_toggle", "p_post_id", "p_user_id", "p_reaction"] },
  { file: "20261002_gh_follow_status.sql", class: "REQUIRED", why: "Follow status RPC", mustContain: ["gh_follow_status"] },
  { file: "20261003_gh_social_notifications.sql", class: "REQUIRED", why: "Notification inbox", mustContain: ["gh_social_notification"] },
  { file: "20261004_gh_search.sql", class: "REQUIRED", why: "People search", mustContain: ["gh_search_people"] },
  { file: "20261006_gh_notif_share_type.sql", class: "REQUIRED", why: "Share notif type", mustContain: [] },
  { file: "202610150001_gh_post_list_feed_stable_cursor.sql", class: "REQUIRED", why: "Stable feed cursor", mustContain: ["gh_post_list_feed"] },
  { file: "202610150002_gh_comment_stable_cursor.sql", class: "REQUIRED", why: "Comment cursor + create", mustContain: ["gh_comment_list_v2", "gh_comment_create"] },
  { file: "20261017_match_signals_durable.sql", class: "REQUIRED", why: "Match signals", mustContain: ["match_signal"] },
  { file: "20261018_gh_engagement_rosters.sql", class: "REQUIRED", why: "Reaction/vote/view/story rosters + comment emoji reactions", mustContain: ["gh_list_post_reactions", "gh_list_post_viewers", "gh_comment_reaction_toggle"] },
  { file: "20261021_gh_social_notifications_types_extend.sql", class: "REQUIRED", why: "Extended notif types", mustContain: [] },
]

const CRITICAL_RPC_HINTS = [
  "ghc_connection_request_upsert",
  "ghc_connection_request_accept",
  "gh_post_list_feed",
  "gh_post_create",
  "gh_reaction_toggle",
  "gh_comment_create",
  "gh_comment_list",
  "gh_follow_set",
  "gh_follow_list",
  "gh_follow_status",
]

function main() {
  let onDisk = new Set()
  try {
    onDisk = new Set(readdirSync(migDir).filter((f) => f.endsWith(".sql")))
  } catch {
    console.error("No supabase/migrations directory")
    process.exit(1)
  }

  console.log(`
GH-CONNECT multi-user migration inventory (operator)
====================================================
Statuses: ON_DISK | MISSING | INCONSISTENT (SQL lacks expected symbols)
APPLIED: UNKNOWN without read-only access to the target database
This script does NOT apply SQL.
`)

  let missing = 0
  let inconsistent = 0

  console.log("Critical multi-user path:\n")
  for (const [i, row] of MULTIUSER_CRITICAL.entries()) {
    const exists = onDisk.has(row.file)
    let status = exists ? "ON_DISK" : "MISSING"
    let detail = ""
    if (!exists) {
      missing++
    } else if (row.mustContain?.length) {
      const sql = readFileSync(join(migDir, row.file), "utf8")
      const absent = row.mustContain.filter((s) => !sql.includes(s))
      if (absent.length) {
        status = "INCONSISTENT"
        inconsistent++
        detail = ` missing symbols: ${absent.join(", ")}`
      }
    }
    console.log(`  ${String(i + 1).padStart(2)}. [${row.class.padEnd(17)}] [${status}] ${row.file}`)
    console.log(`      → ${row.why}${detail}`)
    console.log(`      → APPLIED: UNKNOWN (operator must verify target Supabase)`)
  }

  console.log("\nRequired RPC symbols (must appear in ON_DISK migrations somewhere):\n")
  const allSql = [...onDisk]
    .map((f) => {
      try {
        return readFileSync(join(migDir, f), "utf8")
      } catch {
        return ""
      }
    })
    .join("\n")
  let rpcMissing = 0
  for (const rpc of CRITICAL_RPC_HINTS) {
    const found = allSql.includes(rpc)
    if (!found) rpcMissing++
    console.log(`  · [${found ? "ON_DISK" : "MISSING"}] ${rpc}`)
  }

  console.log(`
Summary:
  Missing critical files: ${missing}
  Inconsistent critical files: ${inconsistent}
  Missing RPC symbols in any migration: ${rpcMissing}
  Applied status: UNKNOWN (no live DB registry inspected)
`)
  process.exit(missing + inconsistent + rpcMissing > 0 ? 1 : 0)
}

main()
