#!/usr/bin/env node
/** Local static check: reaction migration defines gh_reaction_toggle with expected params. */
import { readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const file = join(root, "supabase/migrations/202609260002_gh_reaction_multi_type.sql")
if (!existsSync(file)) {
  console.error("FAIL: reaction migration missing on disk")
  process.exit(1)
}
const sql = readFileSync(file, "utf8")
const need = ["CREATE OR REPLACE FUNCTION public.gh_reaction_toggle", "p_post_id", "p_user_id", "p_reaction", "GRANT EXECUTE"]
let fail = 0
for (const n of need) {
  if (!sql.includes(n)) {
    console.error("FAIL missing:", n)
    fail++
  } else console.log("PASS", n)
}
process.exit(fail ? 1 : 0)
