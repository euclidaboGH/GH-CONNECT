#!/usr/bin/env node
/**
 * Static Stage 2 source gate — fails CI if critical financial SQL/symbols missing.
 */
import { spawnSync } from "node:child_process"

const r = spawnSync(process.execPath, ["scripts/operator-stage2-financial-gates.mjs"], {
  stdio: "inherit",
  cwd: process.cwd(),
})
process.exit(r.status === 0 ? 0 : 1)
