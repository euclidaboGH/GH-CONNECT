#!/usr/bin/env node
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, symlinkSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const script = resolve(fileURLToPath(new URL("./prepare-vercel-build.mjs", import.meta.url)))
const temp = mkdtempSync(join(tmpdir(), "greenhaven-run272-build-prep-"))
const assert = (condition, label) => {
  if (!condition) throw new Error(`FAIL ${label}`)
  console.log(`PASS ${label}`)
}
try {
  const cache = join(temp, ".next", "cache", "webpack")
  mkdirSync(cache, { recursive: true })
  writeFileSync(join(cache, "oversized-pack.pack"), "synthetic-cache")
  const clean = spawnSync(process.execPath, [script], { cwd: temp, encoding: "utf8" })
  assert(clean.status === 0, "normal stale Webpack cache cleanup succeeds")
  assert(!existsSync(cache), "only the stale Webpack cache directory is removed")

  const outside = join(temp, "outside")
  mkdirSync(outside)
  writeFileSync(join(outside, "preserve.txt"), "preserve")
  mkdirSync(join(temp, ".next", "cache"), { recursive: true })
  symlinkSync(outside, cache, "dir")
  const blocked = spawnSync(process.execPath, [script], { cwd: temp, encoding: "utf8" })
  assert(blocked.status !== 0, "symlinked Webpack cache cleanup is refused")
  assert(readFileSync(join(outside, "preserve.txt"), "utf8") === "preserve", "symlink target remains untouched")
  console.log("Run 272 Vercel build-prep tests: 4/4 passed")
} finally {
  rmSync(temp, { recursive: true, force: true })
}
